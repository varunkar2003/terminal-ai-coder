// Tool definitions in OpenAI function-calling format
// Used by all providers (Anthropic/Gemini convert internally)

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file with line numbers. Use this to examine code, configs, or any text file.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the file relative to project root' },
          lines: { type: 'string', description: 'Optional line range, e.g. "1-50" or "10-30"' },
        },
        required: ['file_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file with the given content. Creates parent directories if needed.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the file relative to project root' },
          content: { type: 'string', description: 'The full content to write to the file' },
        },
        required: ['file_path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Edit a file by searching for a text string and replacing it. Use for targeted modifications.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the file relative to project root' },
          search: { type: 'string', description: 'The exact text to find in the file' },
          replace: { type: 'string', description: 'The text to replace it with' },
        },
        required: ['file_path', 'search', 'replace'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Execute a shell command and return its output. Use for running tests, installing packages, git commands, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'glob_search',
      description: 'Search for files matching a glob pattern. Use to discover project structure.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern, e.g. "src/**/*.js" or "*.py"' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep_search',
      description: 'Search file contents with a regex pattern. Use to find code patterns, function definitions, imports, etc.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          file_glob: { type: 'string', description: 'Glob to filter which files to search. Defaults to **/* if not provided' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the internet using DuckDuckGo. Use when you need current information, documentation, or answers not in the project.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch and read the text content of a web page or API endpoint. Use to read documentation, APIs, or any URL.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_navigate',
      description: 'Open a URL in a headless browser. Use this to interact with websites that need JavaScript, forms, or clicking.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to open in the browser' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_get_text',
      description: 'Get all visible text content from the current browser page.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_get_links',
      description: 'Get all links on the current browser page with their text and URLs.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_get_inputs',
      description: 'Get all form inputs, buttons, and their CSS selectors on the current page. Use this to find what to click or fill.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_click',
      description: 'Click an element on the page by CSS selector.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of element to click, e.g. "#submit-btn" or "button.search"' },
        },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_type',
      description: 'Type text into an input field by CSS selector.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the input field' },
          text: { type: 'string', description: 'Text to type into the field' },
        },
        required: ['selector', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_submit',
      description: 'Submit a form by clicking a button or pressing Enter.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of submit button. If empty, presses Enter.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_screenshot',
      description: 'Take a screenshot of the current browser page. Saves to ~/.vkcoder/screenshots/',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  // ─── Memory ─────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'memory_set',
      description: 'Remember a fact or preference permanently. Use this when the user says "remember that..." or shares a preference.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Short label for the memory, e.g. "preferred_language" or "aws_region"' },
          value: { type: 'string', description: 'The value to remember' },
        },
        required: ['key', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memory_get',
      description: 'Recall a previously stored memory by key.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The memory key to look up' },
        },
        required: ['key'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memory_list',
      description: 'List all stored memories.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ─── Mac Control ────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'mac_run_applescript',
      description: 'Run an AppleScript command on macOS. Use to control apps, show notifications, get clipboard, automate the Mac.',
      parameters: {
        type: 'object',
        properties: {
          script: { type: 'string', description: 'The AppleScript code to execute' },
        },
        required: ['script'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mac_open_app',
      description: 'Open/activate a macOS application by name.',
      parameters: {
        type: 'object',
        properties: {
          app_name: { type: 'string', description: 'App name, e.g. "Safari", "Spotify", "Visual Studio Code"' },
        },
        required: ['app_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mac_notification',
      description: 'Show a macOS notification.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Notification title' },
          message: { type: 'string', description: 'Notification message' },
        },
        required: ['title', 'message'],
      },
    },
  },
  // ─── Git ────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Show git status: branch, changed files, ahead/behind.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'Show git diff of current changes.',
      parameters: {
        type: 'object',
        properties: {
          staged: { type: 'boolean', description: 'If true, show only staged changes' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_log',
      description: 'Show recent git commits.',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'Number of commits to show (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_commit',
      description: 'Stage all changes and create a git commit.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_push',
      description: 'Push commits to the remote repository.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ─── Scheduler ──────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'schedule_task',
      description: 'Schedule a command to run repeatedly on an interval. Use for monitoring, health checks, periodic tasks.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Unique name for this task' },
          command: { type: 'string', description: 'Shell command to run' },
          interval_minutes: { type: 'number', description: 'How often to run, in minutes' },
        },
        required: ['name', 'command', 'interval_minutes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_scheduled_tasks',
      description: 'List all active scheduled tasks.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_scheduled_task',
      description: 'Cancel a scheduled task by name.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the task to cancel' },
        },
        required: ['name'],
      },
    },
  },
  // ─── Multi-Agent ────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'spawn_agent',
      description: 'Spawn a sub-agent to work on a specific task independently. Use for complex tasks that can be broken into parts.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Detailed description of the task for the sub-agent' },
        },
        required: ['task'],
      },
    },
  },
  // ─── Undo ──────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'undo_last',
      description: 'Undo the last file write or edit made by the AI. Reverts the file to its previous content.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'undo_history',
      description: 'Show the list of file changes that can be undone.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ─── Project Templates ─────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_project',
      description: 'Scaffold a new project from a template. Available templates: react, express, html, python-flask.',
      parameters: {
        type: 'object',
        properties: {
          template: { type: 'string', description: 'Template name: react, express, html, or python-flask' },
          name: { type: 'string', description: 'Project/directory name' },
        },
        required: ['template', 'name'],
      },
    },
  },
  // ─── Screen Capture ─────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'capture_screen',
      description: 'Take a screenshot of the Mac screen. Returns the file path.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ─── Deploy ─────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'deploy',
      description: 'Deploy the project. Supports: vercel, netlify, or ssh (rsync to a server).',
      parameters: {
        type: 'object',
        properties: {
          platform: { type: 'string', description: 'Deploy target: vercel, netlify, or ssh' },
          host: { type: 'string', description: 'SSH host (only for ssh deploy)' },
          path: { type: 'string', description: 'Remote path (only for ssh deploy)' },
        },
        required: ['platform'],
      },
    },
  },
  // ─── Database ───────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'db_query',
      description: 'Run a SQL query on a SQLite database file.',
      parameters: {
        type: 'object',
        properties: {
          db_path: { type: 'string', description: 'Path to the .db or .sqlite file' },
          query: { type: 'string', description: 'SQL query to run' },
        },
        required: ['db_path', 'query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'db_describe',
      description: 'Show all tables and their columns in a SQLite database.',
      parameters: {
        type: 'object',
        properties: {
          db_path: { type: 'string', description: 'Path to the .db or .sqlite file' },
        },
        required: ['db_path'],
      },
    },
  },
  // ─── API Testing ────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'test_api',
      description: 'Test an HTTP API endpoint. Returns status, time, and response body.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Full URL to test' },
          method: { type: 'string', description: 'HTTP method: GET, POST, PUT, DELETE (default: GET)' },
          body: { type: 'string', description: 'Request body as JSON string (for POST/PUT)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'health_check',
      description: 'Run a health check on a base URL — tests /, /health, /api, /api/status.',
      parameters: {
        type: 'object',
        properties: {
          base_url: { type: 'string', description: 'Base URL, e.g. http://localhost:3000' },
        },
        required: ['base_url'],
      },
    },
  },
  // ─── Code Learning ──────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'learn_code_patterns',
      description: 'Analyze the project code to learn coding style and preferences. Saves patterns to memory.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ─── File Watching ──────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'watch_files',
      description: 'Start watching the project directory for file changes.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_file_changes',
      description: 'Get recent file changes detected by the file watcher.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ─── Time Travel ─────────────────────────────────────────────
  { type:'function', function:{ name:'file_history', description:'Show git history of a specific file.', parameters:{ type:'object', properties:{ file_path:{type:'string',description:'File path'}, count:{type:'number',description:'Number of commits (default 15)'} }, required:['file_path'] } } },
  { type:'function', function:{ name:'file_at_commit', description:'Show file contents at a specific git commit.', parameters:{ type:'object', properties:{ file_path:{type:'string',description:'File path'}, commit:{type:'string',description:'Commit hash or ref like HEAD~3'} }, required:['file_path','commit'] } } },
  { type:'function', function:{ name:'find_bug_commit', description:'Find which commit introduced or removed a specific text in a file using git log -S.', parameters:{ type:'object', properties:{ file_path:{type:'string',description:'File path'}, search_text:{type:'string',description:'Text to search for in history'} }, required:['file_path','search_text'] } } },
  { type:'function', function:{ name:'what_changed', description:'Show what changed in the project in the last N days.', parameters:{ type:'object', properties:{ days:{type:'number',description:'Number of days to look back (default 7)'} } } } },
  { type:'function', function:{ name:'git_blame', description:'Show who changed specific lines of a file.', parameters:{ type:'object', properties:{ file_path:{type:'string',description:'File path'}, line_start:{type:'number',description:'Start line'}, line_end:{type:'number',description:'End line'} }, required:['file_path','line_start'] } } },
  // ─── Self-Evolving ───────────────────────────────────────────
  { type:'function', function:{ name:'create_tool', description:'Create a new custom tool that VKCoder can use. The AI writes its own tools.', parameters:{ type:'object', properties:{ name:{type:'string',description:'Tool name (lowercase, underscores)'}, description:{type:'string',description:'What the tool does'}, parameters:{type:'string',description:'JSON schema for parameters'}, code:{type:'string',description:'JavaScript code for the execute function body'} }, required:['name','description','code'] } } },
  // ─── Knowledge Base ──────────────────────────────────────────
  { type:'function', function:{ name:'save_knowledge', description:'Save learned knowledge about a topic to the cross-project knowledge base.', parameters:{ type:'object', properties:{ topic:{type:'string',description:'Topic/key'}, content:{type:'string',description:'Knowledge content'} }, required:['topic','content'] } } },
  { type:'function', function:{ name:'get_knowledge', description:'Search the knowledge base across all projects.', parameters:{ type:'object', properties:{ topic:{type:'string',description:'Topic to search for'} }, required:['topic'] } } },
  { type:'function', function:{ name:'learn_from_project', description:'Analyze the current project and save tech stack, dependencies, and patterns to the knowledge base.', parameters:{ type:'object', properties:{} } } },
  // ─── Reverse Engineering ─────────────────────────────────────
  { type:'function', function:{ name:'analyze_website', description:'Reverse-engineer a website: detect tech stack, frameworks, page structure.', parameters:{ type:'object', properties:{ url:{type:'string',description:'URL to analyze'} }, required:['url'] } } },
  // ─── Blockchain ──────────────────────────────────────────────
  { type:'function', function:{ name:'blockchain_balance', description:'Check cryptocurrency wallet balance on Ethereum, Polygon, BSC, Arbitrum, or Base.', parameters:{ type:'object', properties:{ address:{type:'string',description:'Wallet address (0x...)'}, chain:{type:'string',description:'Chain: ethereum, polygon, bsc, arbitrum, base'} }, required:['address'] } } },
  { type:'function', function:{ name:'blockchain_tx', description:'Look up a blockchain transaction by hash.', parameters:{ type:'object', properties:{ tx_hash:{type:'string',description:'Transaction hash'}, chain:{type:'string',description:'Chain name (default: ethereum)'} }, required:['tx_hash'] } } },
  { type:'function', function:{ name:'blockchain_gas', description:'Check current gas price on a blockchain.', parameters:{ type:'object', properties:{ chain:{type:'string',description:'Chain name (default: ethereum)'} } } } },
  // ─── Model Swap ──────────────────────────────────────────────
  { type:'function', function:{ name:'switch_model', description:'Switch to a different AI model mid-conversation.', parameters:{ type:'object', properties:{ model:{type:'string',description:'Model name, e.g. qwen3.5:4b, qwen2.5-coder:7b'} }, required:['model'] } } },
  { type:'function', function:{ name:'auto_select_model', description:'Automatically pick the best model for a task based on complexity.', parameters:{ type:'object', properties:{ task:{type:'string',description:'Description of the task'} }, required:['task'] } } },
  // ─── Process Manager ─────────────────────────────────────────
  { type:'function', function:{ name:'start_process', description:'Start a long-running background process (like a server). Managed by VKCoder.', parameters:{ type:'object', properties:{ name:{type:'string',description:'Unique name for this process'}, command:{type:'string',description:'Shell command to run'} }, required:['name','command'] } } },
  { type:'function', function:{ name:'stop_process', description:'Stop a managed background process.', parameters:{ type:'object', properties:{ name:{type:'string',description:'Process name'} }, required:['name'] } } },
  { type:'function', function:{ name:'process_logs', description:'View recent logs from a managed background process.', parameters:{ type:'object', properties:{ name:{type:'string',description:'Process name'}, count:{type:'number',description:'Number of log lines (default 20)'} }, required:['name'] } } },
  { type:'function', function:{ name:'list_processes', description:'List all managed background processes and their status.', parameters:{ type:'object', properties:{} } } },
  // ─── Pentest ─────────────────────────────────────────────────
  { type:'function', function:{ name:'security_scan', description:'Run a security scan on a URL: check headers, exposed paths, CORS, SSL, injection vulnerabilities.', parameters:{ type:'object', properties:{ url:{type:'string',description:'Base URL to scan'} }, required:['url'] } } },
  // ─── Hardware ────────────────────────────────────────────────
  { type:'function', function:{ name:'system_info', description:'Get detailed system information: CPU, memory, disk, battery, network.', parameters:{ type:'object', properties:{} } } },
  { type:'function', function:{ name:'resource_usage', description:'Check current CPU and memory usage. Warns if system is under heavy load.', parameters:{ type:'object', properties:{} } } },
];
