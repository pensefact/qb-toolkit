const DEFAULT_URL = "http://localhost:2707";

export interface BridgeStatus {
  connected: boolean;
  port: number;
}

export interface BatchResult {
  index: number;
  success: boolean;
  response?: string;
  error?: string;
}

export class QBBridgeClient {
  private baseUrl: string;

  constructor(baseUrl = DEFAULT_URL) {
    this.baseUrl = baseUrl;
  }

  async status(): Promise<BridgeStatus> {
    const res = await fetch(`${this.baseUrl}/status`);
    if (!res.ok) throw new Error(`Bridge status failed: ${res.status}`);
    return res.json();
  }

  async sendRequest(qbXml: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/qbxml`, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: qbXml,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Bridge request failed: ${err}`);
    }
    return res.text();
  }

  async sendBatch(requests: string[]): Promise<BatchResult[]> {
    const body = requests.join("\n---\n");
    const res = await fetch(`${this.baseUrl}/batch`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Bridge batch failed: ${err}`);
    }
    return res.json();
  }

  async close(): Promise<void> {
    await fetch(`${this.baseUrl}/close`);
  }
}
