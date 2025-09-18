# Sales-Catalyst 🚀🤖

Sales-Catalyst is a next-generation, hyper-efficient AI sales assistant built around the Catalyst Agent. It automates sales workflows, streamlines meeting prep and follow-up, and delivers actionable insights—all via a conversational interface powered by advanced LLMs and vision tools.

---

## Table of Contents

- [Key Technical Highlights](#key-technical-highlights)
- [Layman-Friendly Explanation](#layman-friendly-explanation)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Using Docker](#using-docker)
- [Endpoints](#endpoints)
- [Catalyst Agent Workflow (User Journey)](#catalyst-agent-workflow-user-journey)
- [Security & Privacy](#security--privacy)
- [Contributing](#contributing)
- [License](#license)

---

## Key Technical Highlights

- **Catalyst Agent Orchestration:** Modular LLM agent (`agents/catalyst_agent.py`) orchestrates all core workflows: meeting briefing, product recommendation, competitor comparison, recap, invite/email creation, and technical Q&A.
- **Vision-to-RAG:** Seamless workflow from images/diagrams to product search and recommendations.
- **Strict Workflow Automation:** Pre-meeting, in-meeting, and post-meeting flows are step-by-step and stateful.
- **Natural Language Interaction:** Friendly, concise, and always professional—never raw data or code.
- **Sales-Specific Tools:** Custom tools for meeting briefing, competitor analysis, recap, and action automation.
- **Data Handling:** Never exposes raw JSON; always interprets tool output into natural language.
- **Cloud-Ready:** Designed for scalable, cloud-native deployment.

---

## Layman-Friendly Explanation

Sales-Catalyst is like having a sharp, always-on sales coordinator. It prepares you for meetings, analyzes competitor info, recommends products from diagrams, and handles your post-meeting follow-ups. Just chat or share a photo—Catalyst handles the rest, taking care of calendar invites and emails, too.

---

## Project Structure

```text
Sales-Catalyst/
├── agents/
│   └── catalyst_agent.py          # Core Catalyst Agent orchestration (LLM, tools, workflow logic)
├── tools/
│   ├── sales_tools.py             # Meeting briefing, comparison, recap, invite/email, product info tools
│   └── ...                        # Additional tool modules
├── frontend/
│   ├── static/
│   │   ├── index.html             # Main UI
│   │   ├── js/                    # Chat, audio, workflow logic
│   │   └── styles/                # CSS styles
│   └── assets/                    # Images, icons, etc.
├── requirements.txt               # Python dependencies
├── Dockerfile                     # Container build instructions
├── deploy.sh                      # Deployment script
├── .env                           # Environment variables (not committed)
├── README.md
└── LICENSE
```

---

## Tech Stack

- **Python** (Catalyst Agent, tool APIs)
- **JavaScript, HTML5, CSS3** (Modern frontend)
- **FastAPI** (API server, WebSockets)
- **Google ADK** (LLM, vision, agent toolkit)
- **Docker & Shell** (DevOps, deployment)

---

## Environment Variables

Create a `.env` file as needed:

```env
GOOGLE_API_KEY='your-google-api-key'
GOOGLE_PROJECT_ID='your-gcp-project'
CRM_API_KEY='your-crm-api-key'
EMAIL_SERVICE_KEY='your-email-key'
LOCATION='us-central1'
STAGING_BUCKET='gs://your-staging-bucket'
GCP_BUCKET_NAME='your-gcp-bucket'
```
> **Never commit `.env` or secrets to source control.**

---

## Running Locally

1. **Python backend:**
   ```sh
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   # Add your credentials to .env
   uvicorn agents.catalyst_agent:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Frontend:**
   - Open `frontend/static/index.html` in your browser, or run a simple HTTP server:
     ```sh
     cd frontend/static
     python -m http.server 8080
     ```

---

## Using Docker

```sh
docker build -t sales-catalyst .
docker run -p 8000:8000 --env-file .env sales-catalyst
```

---

## Endpoints

- **`GET /`** — Main UI (chat, workflow triggers)
- **`/static/*`** — Static assets (HTML, JS, CSS, images)
- **WebSocket:** `ws://<host>/ws/{session_id}`  
  - All agent conversations (chat, audio, images) occur here.

---

## Catalyst Agent Workflow (User Journey)

### Pre-Meeting Workflow
1. **Greeting:** Catalyst greets Alex professionally.
2. **Briefing:** On request, Catalyst fetches and summarizes a full meeting briefing (contacts, history, opportunity, painpoints).
3. **Visual Prompt:** Immediately prompts Alex to share additional technical details or diagrams.
4. **Visual Intake:** Waits for Alex to upload or share an image/diagram.

### Vision-to-RAG Workflow
5. **Image Analysis:** Catalyst analyzes shared image/diagram for customer needs and formulates a product search.
6. **Product Recommendation:** Calls product info tool, recommends the right product based on RAG search, and explains why based on the tool's returned info.
7. **Comparison Offer:** Proactively asks if Alex wants a competitor comparison.
8. **Comparison Delivery:** If confirmed, provides a concise, factual comparison.

### Post-Meeting Workflow
9. **Recap Initiation:** On "recap" request, asks Alex for notes or images.
10. **Recap Analysis:** Extracts and summarizes discussion points, action items, and follow-up date from shared notes/image.
11. **Recap Delivery:** Reads back the summary conversationally.
12. **Invite Creation:** Offers to create a calendar invite; if confirmed, creates and reports result based on tool output.
13. **Email Draft:** Offers to draft a follow-up email; if confirmed, creates and reports result.

### General Requests & Exits
- **Technical/Product Questions:** Answers using product info tools.
- **Graceful Exit:** Friendly, succinct sign-off when finished.

> At every step, the Catalyst agent always interprets tool outputs to natural language, never reveals raw data, and never deviates from the above workflows or order.

---

## Security & Privacy

- Never commit `.env` or secrets.
- Use HTTPS/TLS in production.
- Minimize logging of PII.
- Add authentication and RBAC before production.
- Restrict tool/API access with IAM/API keys.

---

## Contributing

1. Fork the repo, create a feature branch, and open a Pull Request.
2. Keep changes modular and update documentation as needed.
3. Run linters/tests before submitting.
4. Open issues for feature requests or improvements.

---

## License

MIT — see [LICENSE](LICENSE).
