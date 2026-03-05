# n8n SDLC Helper Workflows

Helper workflows that run inside your n8n instance to support SDLC operations.

## Slot Creator

**File:** `slot-creator-workflow.json`

Creates empty workflow slots in bulk and transfers them to your project folder. This eliminates the need to manually create empty workflows in the n8n UI before the reserve step.

### Why This Exists

The n8n API creates new workflows in the "Personal" folder, not in project folders. This helper works around that limitation by:

1. Creating empty workflows via `POST /api/v1/workflows`
2. Transferring each to the target project via `PUT /api/v1/workflows/:id/transfer`

### Setup

1. **Get an n8n API key**
   - Go to your n8n instance Settings > API
   - Create a new API key (or use an existing one)
   - Copy the key

2. **Import the workflow**
   - In n8n, go to your project folder
   - Click "Add workflow" > "Import from file"
   - Select `slot-creator-workflow.json`

3. **Activate the workflow**
   - Open the imported "SDLC Slot Creator" workflow
   - Toggle it to Active

4. **Copy the webhook URL**
   - Click the Webhook node ("Receive Request")
   - Copy the **Production** webhook URL
   - It will look like: `https://your-n8n.example.com/webhook/sdlc/create-slots`

5. **Save the URL in your project config**
   - Open `n8n-sdlc/config/project.json`
   - Set `slotCreator.webhookUrl` to the copied URL

### How It Works

The AI agent calls the webhook during the reserve step with:

```json
{
  "projectId": "your-n8n-project-id",
  "count": 5,
  "baseUrl": "https://your-n8n.example.com",
  "apiKey": "your-n8n-api-key",
  "names": ["DEV-Support Agent", "DEV-Billing Agent", "DEV-List Invoices", "DEV-Ticket Lookup", "DEV-Get Totals"]
}
```

Response:

```json
{
  "success": true,
  "created": [
    {"id": "abc123", "name": "DEV-Support Agent"},
    {"id": "def456", "name": "DEV-Billing Agent"}
  ],
  "count": 5,
  "requested": 5,
  "errors": []
}
```

### Requirements

- **n8n version**: 1.30+ (requires `fetch` support in Code nodes)
- **n8n API**: REST API must be enabled with a valid API key
- **Enterprise feature**: The workflow transfer endpoint (`PUT /workflows/:id/transfer`) requires n8n Enterprise or Community Edition with project support

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Create failed (HTTP 401)` | Invalid API key | Check the API key is correct and active |
| `Transfer failed (HTTP 404)` | Transfer endpoint unavailable | Verify your n8n version supports project transfers |
| `Transfer failed (HTTP 400)` | Invalid project ID | Check `projectId` matches your n8n project |
| `fetch is not defined` | n8n version too old | Upgrade to n8n 1.30+ or rewrite Code node to use HTTP Request nodes |
| Workflows created but in "Personal" | Transfer step failed | Check errors array in response; verify project ID |

### Security Notes

- The webhook URL acts as a shared secret (unguessable UUID path)
- The API key is passed per-request, not stored in the workflow
- The webhook should only be called from your local network or AI agent
- Consider using n8n's webhook authentication options for additional security
