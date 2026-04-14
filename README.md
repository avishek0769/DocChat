# DocChat - Chat with Docs (RAG Application)

Chat with any documentation using AI. Provide a documentation link, and the system will scrape, process, and convert it into a searchable knowledge base that you can interact with through natural language.

Check out the live website here: [DocChat](https://avishek.short.gy/docchat)

---

## Overview

This project implements a Retrieval-Augmented Generation (RAG) system designed for documentation. It allows users to convert any documentation website into an interactive chat interface powered by large language models.

The system handles crawling, chunking, embedding, indexing, and querying in a structured pipeline.

---

## Features

### Documentation Ingestion

* Accepts a documentation URL as input
* Recursively crawls internal links
* Applies limits to avoid excessive crawling

### Data Processing Pipeline

* Cleans and extracts meaningful content from HTML
* Splits content into manageable chunks
* Generates vector embeddings for each chunk

### Vector Search

* Stores embeddings in Qdrant
* Performs similarity search to retrieve relevant context

### Knowledge Base Reuse (Instant Chat Creation)

* If a documentation URL has already been ingested, the system reuses the existing knowledge base
* Works for the same user and for different users
* New chat creation for the same docs URL becomes instant (no re-ingestion wait)

### Chat Interface

* Users can ask questions about the ingested documentation
* Responses are generated using retrieved context
* Each response includes source references

### Usage Tracking

* Tracks token usage per request
* Stores model usage details
* Enables usage monitoring for users

### API Key Support

* Users can provide their own API keys
* Supports multiple providers
* Keys are encrypted before storage

### Background Processing

* Ingestion runs asynchronously
* Tracks progress with status updates (processing, ready, failed)

---

## Supported LLM Providers

* OpenAI
* Anthropic
* Google (Gemini)
* xAI (Grok)
* OpenRouter

---

## Architecture

### High-Level Flow

1. User submits a documentation URL
2. System crawls and collects internal pages
3. Content is cleaned and split into chunks
4. Chunks are embedded using an embedding model
5. Embeddings are stored in Qdrant collections (one per unique docs URL and reused across chats)
6. User query triggers similarity search
7. Retrieved context is passed to the LLM
8. LLM generates response with references

---

## Database Design

### Users

Stores user account details.

### Chats

Represents a documentation session created by a user.

### Chat Sources

Stores root documentation links associated with a chat.

### Chat Messages

Stores conversation messages including prompts and responses along with token usage.

### Chat Message Sources

Stores the source chunks used to generate each response.

### Usage Events

Tracks token usage across different operations (chat, embedding, system).

### API Keys

Stores encrypted API keys provided by users.

---

## Vector Storage (Qdrant)

* Each unique docs URL has a collection that can be reused by multiple chats
* Collections store:

  * Embedding vectors
  * Payload (text, source URL, metadata)
* Enables isolated and efficient similarity search per chat

---

## Installation and Setup

```
git clone https://github.com/avishek0679/DocChat.git
cd DocChat
pnpm install
pnpm run dev
```

---

## API Key Handling

* API keys are encrypted using a server-side encryption key
* Keys are never stored in plaintext
* Decryption happens only when making requests to providers

---

## Limitations

* Works best with static documentation websites
* JavaScript-heavy sites may not be fully supported
* Large documentation sets may take time to process

---

## Future Improvements

* Improved code-aware chunking
* Better support for dynamic websites
* Enhanced ranking and reranking strategies
* Advanced analytics for usage

---

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.

---

## License

MIT License
