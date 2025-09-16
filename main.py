# main.py

import os
import json
import asyncio
import base64
from pathlib import Path
from dotenv import load_dotenv

from google.genai.types import (
    Part,
    Content,
    Blob,
)
from google.genai import types as genai_types

from google.adk.runners import Runner
from google.adk.agents import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.sessions.in_memory_session_service import InMemorySessionService

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from agents.catalyst_agent import catalyst_agent 
# from agents.root_agent import root_agent

from tools.sales_tools import session_context

load_dotenv()

# --- Application Setup ---
APP_NAME = "Sales Catalyst"
STATIC_DIR = Path("frontend/static")
session_service = InMemorySessionService()

async def start_agent_session(session_id: str, is_audio: bool = False):
    """Starts an agent session asynchronously."""
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=session_id,
        session_id=session_id,
    )
    runner = Runner(
        app_name=APP_NAME,
        agent=catalyst_agent,
        # agent = root_agent,
        session_service=session_service,
    )

    if is_audio:
        print("Starting agent in AUDIO mode.")
        run_config = RunConfig(
            speech_config=genai_types.SpeechConfig(
                # language_code="en-US",
                language_code="en-GB",
                voice_config=genai_types.VoiceConfig(
                    prebuilt_voice_config=genai_types.PrebuiltVoiceConfig(
                        voice_name="Aoede"
                    )
                ),
            ),
            response_modalities=['AUDIO'],
            streaming_mode=StreamingMode.BIDI,

            realtime_input_config = genai_types.RealtimeInputConfig(
            automatic_activity_detection=genai_types.AutomaticActivityDetection(
                disabled = False, # default
                # start_of_speech_sensitivity= genai_types.StartSensitivity.START_SENSITIVITY_LOW,
                # end_of_speech_sensitivity=genai_types.EndSensitivity.END_SENSITIVITY_LOW,
                # prefix_padding_ms=200,
                silence_duration_ms= 1000,
            )
        ),
            output_audio_transcription=genai_types.AudioTranscriptionConfig(),
            input_audio_transcription=genai_types.AudioTranscriptionConfig(),
        )
    else:
        print("Starting agent in TEXT mode.")
        run_config = RunConfig(
            response_modalities=['TEXT'], 
            streaming_mode=StreamingMode.BIDI,
        )

    live_request_queue = LiveRequestQueue()
    live_events = runner.run_live(
        session=session,
        live_request_queue=live_request_queue,
        run_config=run_config,
    )
    return live_events, live_request_queue, session

async def agent_to_client_messaging(websocket: WebSocket, live_events, dev_mode: bool = False):
    """Handles sending messages from the agent to the client websocket."""
    async for event in live_events:
        if event.turn_complete or event.interrupted:
            await websocket.send_text(json.dumps({
                "turn_complete": event.turn_complete, 
                "interrupted": event.interrupted
            }))
            continue

        if event.content and event.content.parts:
            author = event.content.role
            for part in event.content.parts:
                if part.text:
                    mime_type = "text/plain"
                    if author == 'user':
                        mime_type = "text/input_transcription"
                    elif event.partial:
                        mime_type = "text/transcription"
                    
                    await websocket.send_text(json.dumps({
                        "mime_type": mime_type,
                        "data": part.text
                    }))

                elif part.inline_data and part.inline_data.mime_type.startswith("audio/"):
                    await websocket.send_text(json.dumps({
                        "mime_type": "audio/pcm", 
                        "data": base64.b64encode(part.inline_data.data).decode("ascii")
                    }))
                
                # --- NEW DEV MODE LOGIC ADDED ---
                # This block sends the "behind-the-scenes" tool data to the frontend
                # if dev_mode is activated in the URL.
                if dev_mode:
                    if part.function_call:
                        # Send what tool the agent is GOING to call
                        args_dict = {key: value for key, value in part.function_call.args.items()}
                        await websocket.send_text(json.dumps({
                            "mime_type": "tool_call",
                            "data": {
                                "name": part.function_call.name,
                                "args": args_dict
                            }
                        }))
                    elif part.function_response:
                        # Send the raw JSON data the tool RETURNED
                        response_dict = {}
                        if part.function_response.response:
                             for key, value in part.function_response.response.items():
                                response_dict[key] = value

                        await websocket.send_text(json.dumps({
                            "mime_type": "tool_result",
                            "data": {
                                "name": part.function_response.name,
                                "response": response_dict
                            }
                        }))

async def client_to_agent_messaging(websocket: WebSocket, live_request_queue: LiveRequestQueue):
    """Handles receiving messages from the client and sending them to the agent."""
    while True:
        message_json = await websocket.receive_text()
        message = json.loads(message_json)
        mime_type = message.get("mime_type")
        data = message.get("data")
        
        if mime_type == "text/plain":
            live_request_queue.send_content(content=Content(role="user", parts=[Part.from_text(text=data)]))
        
        # --- UPDATED TO HANDLE IMAGES ---
        # Both audio and image frames are sent as realtime binary data.
        elif mime_type in ["audio/pcm", "image/jpeg"]:
            live_request_queue.send_realtime(Blob(data=base64.b64decode(data), mime_type=mime_type))


# --- FastAPI App Setup ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def root(): return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, is_audio: bool = False, dev_mode: bool = False):
    """Handles the WebSocket connection for a client session."""
    await websocket.accept()
    print(f"Client #{session_id} connected. Audio mode: {is_audio}, Dev mode: {dev_mode}")

    async def run_tasks_with_context():
        live_events, live_request_queue, session_object = await start_agent_session(session_id, is_audio)
        session_context.set(session_object)
        
        tasks = [
            asyncio.create_task(agent_to_client_messaging(websocket, live_events, dev_mode)),
            asyncio.create_task(client_to_agent_messaging(websocket, live_request_queue)),
        ]
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        
        for task in pending:
            task.cancel()

    try:
        await run_tasks_with_context()
    except WebSocketDisconnect:
        print(f"Client #{session_id} disconnected cleanly.")
    except Exception as e:
        print(f"An error occurred in the websocket endpoint for client #{session_id}: {e}")
    finally:
        print(f"Connection for client #{session_id} closed.")
