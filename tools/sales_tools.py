# sales_tools/tools.py

from google.adk.tools import FunctionTool
import json
from contextvars import ContextVar
from langchain_google_vertexai import VertexAIEmbeddings
from langchain_community.vectorstores import FAISS
import time
import asyncio
from functools import wraps

# --- RAG Setup (No changes needed here) ---
embeddings = VertexAIEmbeddings(model_name="text-embedding-005")
# Ensure the FAISS index has been created by running create_index.py
try:
    db = FAISS.load_local("faiss_index", embeddings, allow_dangerous_deserialization=True)
    retriever = db.as_retriever(search_kwargs={'k': 3})
except Exception as e:
    print(f"Could not load FAISS index. Please run create_index.py first. Error: {e}")
    retriever = None

session_context = ContextVar('session_object', default=None)

# --- Decorator and State Management (No changes needed here) ---
def time_tool(func):
    """A decorator that prints the execution time of a tool function."""
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = await func(*args, **kwargs)
        end_time = time.perf_counter()
        duration = (end_time - start_time) * 1000
        print(f"[PERFORMANCE] Tool '{func.__name__}' executed in {duration:.2f} ms")
        return result

    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        duration = (end_time - start_time) * 1000
        print(f"[PERFORMANCE] Tool '{func.__name__}' executed in {duration:.2f} ms")
        return result
    
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    else:
        return sync_wrapper

def _get_and_init_state():
    """Safely gets the session and initializes it if needed."""
    session = session_context.get()
    if not session: raise Exception("Fatal Error: Could not find session in context.")
    if not session.state:
        session.state = {}
    return session.state

# ==============================================================================
# MODIFIED FUNCTIONS: Now using RAG
# ==============================================================================

@time_tool
def get_meeting_briefing(client_name: str) -> dict:
    """
    Searches the knowledge base for a meeting briefing for a specific client.
    """
    print(f"Tool (RAG): Fetching meeting brief for {client_name}")
    if not retriever:
        return {"status": "error", "message": "Knowledge base is not available."}

    # Use the client name to form a query for the retriever
    query = f"Provide a detailed meeting briefing for the client: {client_name}"
    docs = retriever.invoke(query)
    
    # Combine the content from the retrieved documents
    retrieved_context = "\n---\n".join([doc.page_content for doc in docs])
    # print(f"Briefing context: {retrieved_context}")

    # Construct the message based on the retrieved information
    # message = (
    #     f"Okay, I have your meeting briefing for {client_name}. "
    #     f"Here are the key points from our records:\n{retrieved_context}"
    # )

    return {"status": "success", "message": retrieved_context}

@time_tool
def get_competitor_comparison(product_name: str) -> dict:
    """
    Searches the knowledge base for a side-by-side comparison for a product against its competitors.
    """
    print(f"Tool (RAG): Getting strategic comparison for {product_name}")
    if not retriever:
        return {"status": "error", "message": "Knowledge base is not available."}
        
    # Form a clear query for the retriever
    query = f"Provide a competitor comparison for the product: {product_name}"
    docs = retriever.invoke(query)
    
    # Combine the content from the retrieved documents
    retrieved_context = "\n---\n".join([doc.page_content for doc in docs])

    if not retrieved_context:
        return {"status": "error", "message": f"I couldn't find comparison data for '{product_name}'."}

    message = f"Alright, here is the comparison for {product_name} based on our knowledge base:\n{retrieved_context}"
    return {"status": "success", "message": message}

# ==============================================================================
# UNCHANGED FUNCTIONS
# ==============================================================================

@time_tool
def get_meeting_recap(discussion_points: list[str], action_items: list[str], follow_up_date: str) -> dict:
    """Analyzes extracted meeting notes to generate a structured recap."""

    state = _get_and_init_state()
    # client_name = state.get("last_client_name", "the client")
    client_name = 'Volta Motors'

    print(f"Tool: >>>>> EXECUTING get_meeting_recap for {client_name} <<<<<")

    # Save raw data to state for other tools in the sequence
    state["last_discussion_points"] = discussion_points
    state["last_action_items"] = action_items
    state["last_follow_up_date"] = follow_up_date

    # --- Create the conversational message ---
    points_str = '; '.join(discussion_points)
    actions_str = '; '.join(action_items)
    # message = f"I've generated a recap from your notes. Key discussion points were: {points_str}. Action items are: {actions_str}. The follow-up is set for {follow_up_date}."
    # message = f"Alright, Alex. I'm pulling the meeting recap up on your screen now, including the discussion points and action items. Your follow-up is set for September 18th, 2025."

    # --- Create the structured data dictionary ---
    recap_data = {
        "title": f"Meeting Recap with {client_name}",
        "key_discussion_points": discussion_points,
        "action_items": action_items,
        "follow_up_date": follow_up_date
    }
    
    # --- Return both the message and the data ---
    return { 
        "status": "success", 
        # "message": message,
        "recap_data": recap_data # Add the structured data here
    }

@time_tool
def create_invite_from_recap() -> dict:
    """Schedules a follow-up calendar invite using details from the last recap."""
    state = _get_and_init_state()
    
    # Get details from state, with defaults
    # client_name = state.get("last_client_name", "Volta Motors")
    client_name = 'Volta Motors'
    follow_up_date = state.get("last_follow_up_date", "a future date")
    product = state.get("product_in_focus", "Loctite ESB 5100")

    print(f"Tool: >>>>> EXECUTING create_invite_from_recap for {follow_up_date} <<<<<")

    # Define the structured invite data
    invite_data = {
        "subject": f"Follow-Up: {product} Trial Results",
        "start_time": f"{follow_up_date} 10:00 AM",
        "location": client_name,
        "attendees": ["alex.richter@henkel.com", "david.chen@voltamotors.com", "maria.rodriguez@voltamotors.com"],
        "body": f"This is a follow-up to discuss the trial results of the {product} sample for the Gasketing application. We will also cover product availability and PO details."
    }

    #     # Define the structured invite data
    # invite_data = {
    #     "start_time": f"{follow_up_date} 10:00 AM",
    # }

    # Define the simple message for the agent to speak
    message = f"Okay, the calendar invite for the follow-up on {follow_up_date} has been sent to all participants."

    # Return both the spoken message and the structured data
    return { 
        "status": "success", 
        "message": message,
        "invite_details": invite_data
    }

@time_tool
def create_email_from_recap() -> dict:
    """Drafts a follow-up email using details from the last recap."""
    state = _get_and_init_state()

    # Get all necessary details from state
    # client_name = state.get("last_client_name", "Volta Motors")
    client_name = 'Volta Motors'
    product = state.get("product_in_focus", "Loctite ESB 5100")
    discussion_points = state.get("last_discussion_points", [])
    follow_up_date = state.get("last_follow_up_date", "our upcoming call")

    print(f"Tool: >>>>> EXECUTING create_email_from_recap for {client_name} <<<<<")

    # Format the discussion points into a list
    recap_points_formatted = "\n".join([f"- {point}" for point in discussion_points]) if discussion_points else "- Our key discussion points."

    # Draft the full email body
    full_email_body = f"""Dear David and Maria,

Thank you again for your time today. It was a pleasure discussing your needs for the {client_name} EV battery enclosures.

To recap our conversation, we covered the following key points:
{recap_points_formatted}

As discussed, I have attached the Technical Data Sheet (TDS) for {product} and a relevant case study.

Additionally, based on your concerns about battery performance under harsh environmental conditions, I've attached a 2-pager on our battery simulation and full-scale testing solutions. I believe it will be highly relevant for your upcoming EV launch.

I have our follow-up call scheduled for {follow_up_date} to discuss your testing results and next steps.

Please don't hesitate to reach out if anything comes up before then.

Best regards,
Alex Richter,
Sales Representative,
Henkel
"""
    # Define the structured email data
    email_data = {
        "recipients": ["david.chen@voltamotors.com", "maria.rodriguez@voltamotors.com"],
        "subject": f"Follow-up: {product} for {client_name} EV Battery Enclosures",
        "attachments": ["Loctite_ESB_5100_TDS.pdf", "Success-story-loctite-esb-5100-serviceable-batteries.pdf", "Battery-Engineering-Center.pdf"],
        "body": full_email_body
    }

    # Define the simple message for the agent to speak
    message = f"The draft email to {client_name} is ready. I've also added our battery solutions 2-pager to address their performance concerns. You're all set for the follow-up Alex."
    
    # Return both the spoken message and the structured data
    return { 
        "status": "success", 
        "message": message,
        "email_draft": email_data
    }

@time_tool
def get_product_information(question: str) -> dict:
    """Searches the knowledge base for a technical product question."""
    print(f"Tool: Received question for RAG: '{question}'")
    docs = retriever.invoke(question)
    retrieved_context = "\n---\n".join([doc.page_content for doc in docs])
    return {"status": "success", "message": retrieved_context}


# --- Final Tool Definitions ---
get_meeting_briefing_tool = FunctionTool(get_meeting_briefing)
get_competitor_comparison_tool = FunctionTool(get_competitor_comparison)
get_meeting_recap_tool = FunctionTool(get_meeting_recap)
create_invite_from_recap_tool = FunctionTool(create_invite_from_recap)
create_email_from_recap_tool = FunctionTool(create_email_from_recap)
get_product_information_tool = FunctionTool(get_product_information)
