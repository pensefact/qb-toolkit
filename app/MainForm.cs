using System;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace QBDesktop
{
    class MainForm : Form
    {
        private QBBridge.QBConnection _qb;
        private WebBrowser _browser;
        private HttpListener _listener;
        private readonly string _companyFile;
        private readonly int _port = 2707;

        public MainForm(string companyFile)
        {
            _companyFile = companyFile;
            Text = "QB Toolkit — Bank Reconciliation";
            Size = new Size(1280, 800);
            StartPosition = FormStartPosition.CenterScreen;
            Icon = SystemIcons.Application;

            _browser = new WebBrowser();
            _browser.Dock = DockStyle.Fill;
            _browser.ScriptErrorsSuppressed = true;
            Controls.Add(_browser);

            StartLocalServer();
        }

        private void StartLocalServer()
        {
            _listener = new HttpListener();
            _listener.Prefixes.Add(string.Format("http://localhost:{0}/", _port));
            _listener.Start();

            var thread = new Thread(ListenLoop);
            thread.IsBackground = true;
            thread.Start();

            // Point browser at the bundled UI
            string webDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "web");
            if (Directory.Exists(webDir))
            {
                _browser.Navigate(string.Format("http://localhost:{0}/index.html", _port));
            }
            else
            {
                _browser.DocumentText = "<html><body style='font-family:Segoe UI;padding:40px'>"
                    + "<h2>QB Toolkit</h2>"
                    + "<p>Web UI not found. Run <code>npm run build</code> in the <code>ui/</code> folder "
                    + "and copy the output to <code>web/</code> next to this exe.</p>"
                    + "<p>Bridge is running on port " + _port + " — you can also open "
                    + "<a href='http://localhost:" + _port + "/status'>status</a> or "
                    + "use the dev server at <code>http://localhost:5173</code></p>"
                    + "</body></html>";
            }
        }

        private void ListenLoop()
        {
            while (_listener != null && _listener.IsListening)
            {
                try
                {
                    var ctx = _listener.GetContext();
                    ThreadPool.QueueUserWorkItem(delegate { HandleRequest(ctx); });
                }
                catch (HttpListenerException)
                {
                    break;
                }
                catch (ObjectDisposedException)
                {
                    break;
                }
            }
        }

        private void HandleRequest(HttpListenerContext ctx)
        {
            var req = ctx.Request;
            var res = ctx.Response;

            // Only accept localhost
            if (req.Url.Host != "localhost" && req.Url.Host != "127.0.0.1")
            {
                res.StatusCode = 403;
                res.Close();
                return;
            }

            res.Headers.Add("Access-Control-Allow-Origin", "http://localhost:" + _port);
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 204;
                res.Close();
                return;
            }

            try
            {
                string path = req.Url.AbsolutePath;

                if (path == "/qbxml" && req.HttpMethod == "POST")
                {
                    HandleQBXML(req, res);
                }
                else if (path == "/status" && req.HttpMethod == "GET")
                {
                    bool c = _qb != null && _qb.IsConnected;
                    SendJson(res, 200, "{\"connected\":" + c.ToString().ToLower() + ",\"port\":" + _port + "}");
                }
                else
                {
                    ServeStatic(path, res);
                }
            }
            catch (Exception ex)
            {
                SendJson(res, 500, "{\"error\":\"" + Escape(ex.Message) + "\"}");
            }
        }

        private void HandleQBXML(HttpListenerRequest req, HttpListenerResponse res)
        {
            string body;
            using (var reader = new StreamReader(req.InputStream, req.ContentEncoding))
            {
                body = reader.ReadToEnd();
            }

            if (string.IsNullOrWhiteSpace(body))
            {
                SendJson(res, 400, "{\"error\":\"Empty request body\"}");
                return;
            }

            if (_qb == null)
            {
                _qb = new QBBridge.QBConnection(_companyFile);
            }

            if (!_qb.IsConnected)
            {
                _qb.Connect();
            }

            string response = _qb.ProcessRequest(body);
            SendXml(res, 200, response);
        }

        private void ServeStatic(string path, HttpListenerResponse res)
        {
            if (path == "/") path = "/index.html";

            string webDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "web");
            string filePath = Path.Combine(webDir, path.TrimStart('/').Replace('/', '\\'));

            if (!File.Exists(filePath))
            {
                SendText(res, 404, "Not found");
                return;
            }

            // Prevent path traversal
            string fullWebDir = Path.GetFullPath(webDir);
            string fullFilePath = Path.GetFullPath(filePath);
            if (!fullFilePath.StartsWith(fullWebDir))
            {
                SendText(res, 403, "Forbidden");
                return;
            }

            string ext = Path.GetExtension(filePath).ToLowerInvariant();
            string contentType = "application/octet-stream";
            if (ext == ".html") contentType = "text/html; charset=utf-8";
            else if (ext == ".js") contentType = "application/javascript; charset=utf-8";
            else if (ext == ".css") contentType = "text/css; charset=utf-8";
            else if (ext == ".json") contentType = "application/json";
            else if (ext == ".svg") contentType = "image/svg+xml";
            else if (ext == ".png") contentType = "image/png";
            else if (ext == ".ico") contentType = "image/x-icon";

            byte[] bytes = File.ReadAllBytes(filePath);
            res.StatusCode = 200;
            res.ContentType = contentType;
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        }

        private static void SendJson(HttpListenerResponse res, int status, string body)
        {
            res.StatusCode = status;
            res.ContentType = "application/json";
            byte[] bytes = Encoding.UTF8.GetBytes(body);
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        }

        private static void SendXml(HttpListenerResponse res, int status, string body)
        {
            res.StatusCode = status;
            res.ContentType = "application/xml";
            byte[] bytes = Encoding.UTF8.GetBytes(body);
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        }

        private static void SendText(HttpListenerResponse res, int status, string body)
        {
            res.StatusCode = status;
            res.ContentType = "text/plain";
            byte[] bytes = Encoding.UTF8.GetBytes(body);
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        }

        private static string Escape(string s)
        {
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "");
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (_listener != null)
            {
                _listener.Stop();
                _listener.Close();
                _listener = null;
            }

            if (_qb != null)
            {
                _qb.Dispose();
                _qb = null;
            }

            base.OnFormClosing(e);
        }
    }
}
