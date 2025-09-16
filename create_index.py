# create_index.py

import os
from langchain_google_vertexai import VertexAIEmbeddings
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS

# Make sure your PDFs are in a folder named 'docs'
PDFS_PATH = "docs/"
INDEX_PATH = "faiss_index"

def create_vector_index():
    """
    This function reads all PDFs in the specified directory,
    splits them into chunks, creates embeddings, and saves them
    to a local FAISS vector store.
    """
    print("Starting PDF loading...")
    # Make sure your project is authenticated via `gcloud auth application-default login`
    loader = PyPDFDirectoryLoader(PDFS_PATH)
    documents = loader.load()
    print(f"Loaded {len(documents)} document pages.")

    print("Splitting documents into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    docs = text_splitter.split_documents(documents)
    print(f"Split into {len(docs)} chunks.")

    print("Initializing embeddings model...")
    # Using the standard Vertex AI embeddings model
    embeddings = VertexAIEmbeddings(model_name="text-embedding-005")

    print("Creating and saving the FAISS vector store...")
    db = FAISS.from_documents(docs, embeddings)
    db.save_local(INDEX_PATH)
    print(f"--- Index created successfully at '{INDEX_PATH}' ---")

if __name__ == "__main__":
    # Create a 'docs' folder in your project root and place your two PDFs inside it.
    if not os.path.exists(PDFS_PATH):
        os.makedirs(PDFS_PATH)
        print(f"Created '{PDFS_PATH}' directory. Please add your PDF files there and run again.")
    else:
        create_vector_index()
