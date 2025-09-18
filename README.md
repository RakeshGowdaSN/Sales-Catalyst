# Sales-Catalyst 🚀🤖

Sales-Catalyst is a next-generation, hyper-efficient AI sales assistant built around the Catalyst Agent. It automates sales workflows, streamlines meeting prep and follow-up, and delivers actionable insights—all via a conversational interface powered by advanced LLMs and Retrieval-Augmented Generation (RAG).

---

## Table of Contents

- [Key Technical Highlights](#key-technical-highlights)
- [Layman-Friendly Explanation](#layman-friendly-explanation)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Using Docker](#using-docker)
- [Deploying with deploy.sh](#deploying-with-deploysh)
- [Endpoints](#endpoints)
- [Catalyst Agent Workflow (User Journey)](#catalyst-agent-workflow-user-journey)
- [What is RAG?](#what-is-rag)
- [Security & Privacy](#security--privacy)
- [Contributing](#contributing)
- [License](#license)

---

## Key Technical Highlights

- **Catalyst Agent Orchestration:** The core `agents/catalyst_agent.py` orchestrates all workflows: meeting briefing, product recommendation, competitor comparison, recap, invite/email creation, and technical Q&A.
- **Retrieval-Augmented Generation (RAG):** Sales-Catalyst uses RAG for deep document search and context injection, leveraging a FAISS vector store built from PDFs and knowledge sources.
- **Vision-to-RAG:** Supports workflows from images/diagrams to product recommendations and comparisons.
- **Strict Workflow Automation:** Pre-meeting, in-meeting, and post-meeting flows are step-by-step and stateful.
- **Natural Language Interaction:** Friendly, concise, and always professional—never raw data or code.
- **Sales-Specific Tools:** Modular tools for meeting briefing, competitor analysis, recap, and action automation.
- **Data Handling:** Never exposes raw JSON; always interprets tool output into natural language.
- **Cloud-Ready:** Designed for scalable, cloud-native deployment.

---

## Layman-Friendly Explanation

Sales-Catalyst is like having a sharp, always-on sales coordinator. It prepares you for meetings, analyzes competitor info, recommends products from diagrams, and handles your post-meeting follow-ups. Just chat or share a photo—Catalyst handles the rest, including calendar invites and emails, always using your latest sales knowledge base.

---

## Project Structure

```text
Sales-Catalyst/
├── agents/
│   └── catalyst_agent.py          # Core Catalyst Agent orchestration (LLM, tools, workflow logic)
├── tools/
│   └── sales_tools.py             # Modular tools for briefing, comparison, recap, invites, emails, and RAG integration
├── create_index.py                # Script to build FAISS index from PDFs for RAG
├── docs/                          # Place your PDFs here to build the knowledge base
├── faiss_index/                   # Local FAISS vector store (created by create_index.py)
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

- **Python** (Catalyst Agent, tool APIs, RAG)
- **LangChain, FAISS, VertexAI** (for RAG and LLM integration)
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

1. **Build your knowledge base:**
   - Place your PDFs inside the `docs/` folder.
   - Run:
     ```sh
     python create_index.py
     ```
   - This builds a FAISS vector store (`faiss_index/`) for RAG-based search.

2. **Python backend:**
   ```sh
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   # Add your credentials to .env
   uvicorn agents.catalyst_agent:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Frontend:**
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

## Deploying with deploy.sh

To deploy Sales-Catalyst to a cloud environment (such as Google Cloud Run), use the provided `deploy.sh` script. This script automates the build and deployment process, ensuring all necessary environment variables and containers are configured for production.

**Typical usage:**
```sh
./deploy.sh
```

- Ensure you have set up your cloud credentials and your `.env` file is present with all necessary variables.
- The script will build the Docker image, push it to your configured container registry, and deploy it to the specified cloud service.
- Modify `deploy.sh` as needed for your cloud provider or deployment preferences.

---

## Endpoints

- **`GET /`** — Main UI (chat, workflow triggers)
- **`/static/*`** — Static assets (HTML, JS, CSS, images)
- **WebSocket:** `ws://<host>/ws/{session_id}`  
  - All agent conversations (chat, audio, images) occur here.

---

## Catalyst Agent Workflow (User Journey)

#### Pre-Meeting Workflow
1. **Greeting:** Catalyst greets Alex professionally.
2. **Briefing:** On request, Catalyst fetches and summarizes a full meeting briefing (contacts, history, opportunity, painpoints) using RAG.
3. **Visual Prompt:** Immediately prompts Alex to share technical details or diagrams.
4. **Visual Intake:** Waits for Alex to upload/share an image/diagram.

#### Vision-to-RAG Workflow
5. **Image Analysis:** Catalyst analyzes the shared image/diagram to infer customer needs and formulate a product search.
6. **Product Recommendation:** Calls product info tool (backed by RAG), recommends the right product based on RAG search, and explains why based on retrieved context.
7. **Comparison Offer:** Proactively asks if Alex wants a competitor comparison.
8. **Comparison Delivery:** If confirmed, provides a concise, factual, RAG-backed comparison.

#### Post-Meeting Workflow
9. **Recap Initiation:** On "recap" request, asks Alex for notes or images.
10. **Recap Analysis:** Extracts and summarizes discussion points, action items, and follow-up date from shared notes/images.
11. **Recap Delivery:** Reads back the summary conversationally.
12. **Invite Creation:** Offers to create a calendar invite; if confirmed, creates and reports result.
13. **Email Draft:** Offers to draft a follow-up email; if confirmed, creates and reports result.

#### General Requests & Exits
- **Technical/Product Questions:** Answers using RAG-powered product info retrieval.
- **Graceful Exit:** Friendly, succinct sign-off when finished.

> At every step, the Catalyst agent interprets tool outputs to natural language, never reveals raw data, and never deviates from these workflows.

---

## What is RAG?

**RAG (Retrieval-Augmented Generation)** is an AI architecture that supercharges language models by giving them access to an external knowledge base. Instead of relying only on what the model “remembers,” RAG retrieves the most relevant documents (from PDFs, web pages, or databases) and injects this context into the model’s response, resulting in:
- **Accurate, up-to-date answers** beyond the model’s training cutoff.
- **Grounded, reference-backed responses**—ideal for sales, technical, or enterprise use cases.
- In Sales-Catalyst, your PDFs are converted into vector embeddings (using VertexAI and FAISS), enabling the agent to search, summarize, and reason over your real knowledge base on every question.

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
