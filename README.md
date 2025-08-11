# DocPilot

A modern, AI-powered collaborative document management platform that combines intelligent document processing with real-time workspace collaboration. Built with React, TypeScript, and FastAPI, DocPilot enables teams to create, edit, and manage documents with the help of advanced AI agents.

## ✨ Features

### 🤖 AI-Powered Document Assistant
- **Intelligent Workspace Agent**: Chat with AI to edit, analyze, and manage documents
- **Multiple AI Models**: Choose from Llama 3, Mixtral, and Gemma models for different use cases
- **Smart Document Processing**: Automatic content analysis and intelligent editing suggestions
- **Vector Search**: Find relevant information across all your documents using semantic search

### 👥 Collaborative Workspaces
- **Real-time Collaboration**: Multiple users can work on documents simultaneously
- **Workspace Management**: Create and manage team workspaces with role-based access control
- **File Versioning**: Automatic version control with change tracking and history
- **Invitation System**: Invite team members with customizable permissions

### 📄 Document Management
- **Multi-format Support**: Handle PDF, DOCX, DOC, TXT, and Markdown files
- **Rich Text Editor**: Built-in markdown editor with live preview
- **File Explorer**: Intuitive file organization and navigation
- **Export Options**: Export documents in various formats (PDF, DOCX, HTML)

### 🔧 Developer-Friendly
- **Modern Tech Stack**: React 18, TypeScript, Vite, and Tailwind CSS
- **Component Library**: Built with Radix UI and shadcn/ui components
- **Real-time Updates**: WebSocket integration for live collaboration
- **Responsive Design**: Works seamlessly across desktop and mobile devices

## 🏗️ Architecture

DocPilot consists of two main components:

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and building
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Query for server state management
- **Authentication**: Supabase Auth with JWT tokens
- **UI Components**: Radix UI primitives with shadcn/ui styling

### Backend (FastAPI + Python)
- **Framework**: FastAPI for high-performance API
- **Database**: Supabase (PostgreSQL) for data persistence
- **Vector Store**: Pinecone for document embeddings and search
- **AI Integration**: Groq API with multiple LLM models
- **Document Processing**: PyMuPDF, python-docx for file handling
- **Authentication**: JWT with Supabase integration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.8+
- Supabase account
- Groq API key
- Pinecone account (optional, for vector search)

### Frontend Setup

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd docpilot
npm install
```

2. **Environment Configuration**:
```bash
cp .env.example .env
```

Configure your `.env` file with Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. **Start development server**:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Setup

1. **Navigate to backend directory**:
```bash
cd scribe_backend
```

2. **Install Python dependencies**:
```bash
pip install -r requirements.txt
```

3. **Configure environment**:
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
PINECONE_API_KEY=your_pinecone_api_key
```

4. **Run the backend**:
```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

## 📚 Usage

### Creating Your First Workspace

1. **Sign up/Login**: Create an account or sign in with existing credentials
2. **Create Workspace**: Click the "+" button to create a new workspace
3. **Upload Documents**: Use the upload button to add PDF, DOCX, or text files
4. **Start Chatting**: Use the AI assistant to analyze, edit, or ask questions about your documents

### AI Assistant Commands

The AI assistant understands natural language commands:

- **View**: "Show me the content of proposal.md"
- **Edit**: "Update the timeline in my project plan"
- **Analyze**: "Summarize the key points in this document"
- **Search**: "Find documents that mention 'machine learning'"

### Collaboration

1. **Invite Members**: Use the workspace management panel to invite team members
2. **Set Permissions**: Assign roles (owner, editor, viewer) to control access
3. **Real-time Editing**: Multiple users can edit documents simultaneously
4. **Version History**: Track all changes with automatic version control

## 🛠️ Development

### Project Structure

```
docpilot/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # Reusable UI components
│   │   ├── FileExplorer.tsx # File management interface
│   │   ├── MarkdownEditor.tsx # Document editor
│   │   └── ChatSidebar.tsx  # AI chat interface
│   ├── pages/              # Route components
│   ├── services/           # API integration
│   ├── contexts/           # React contexts
│   └── hooks/              # Custom React hooks
├── scribe_backend/         # FastAPI backend
│   ├── app/               # Application logic
│   ├── configs/           # Configuration files
│   └── main.py           # FastAPI entry point
└── public/               # Static assets
```

### Available Scripts

**Frontend**:
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

**Backend**:
- `uvicorn main:app --reload` - Start development server
- `python -m pytest` - Run tests
- `black .` - Format code

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 🔧 Configuration

### AI Models

DocPilot supports multiple AI models via Groq:

- **llama3-70b-8192**: Most capable, best for complex tasks
- **llama3-8b-8192**: Faster responses, good for simple operations
- **mixtral-8x7b-32768**: Balanced performance and capability
- **gemma-7b-it**: Lightweight option for basic tasks

### Database Schema

The application uses Supabase with these main tables:

- **users**: User accounts and profiles
- **workspaces**: Document workspaces
- **files**: Document storage and metadata
- **file_versions**: Version history
- **collaborators**: Workspace access control
- **chat_messages**: AI conversation history

## 🚀 Deployment

### Frontend (Vercel/Netlify)

1. Build the project: `npm run build`
2. Deploy the `dist` folder to your hosting platform
3. Configure environment variables in your hosting dashboard

### Backend (Docker)

```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- 📧 Email: [support@docpilot.com](mailto:support@docpilot.com)
- 💬 Discord: [Join our community](https://discord.gg/docpilot)
- 📖 Documentation: [docs.docpilot.com](https://docs.docpilot.com)
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/docpilot/issues)

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) for the backend infrastructure
- [Groq](https://groq.com) for AI model access
- [Radix UI](https://radix-ui.com) for accessible components
- [Tailwind CSS](https://tailwindcss.com) for styling
- [FastAPI](https://fastapi.tiangolo.com) for the backend framework

---

**Built with ❤️ by the DocPilot team** 