using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;

namespace QBBridge
{
    class Program
    {
        private static QBConnection _connection;
        private static readonly int Port = 2707;

        static void Main(string[] args)
        {
            Console.WriteLine("QB Bridge starting...");

            string companyFile = args.Length > 0 ? args[0] : "";
            _connection = new QBConnection(companyFile);

            var listener = new HttpListener();
            listener.Prefixes.Add(string.Format("http://localhost:{0}/", Port));
            listener.Start();
            Console.WriteLine(string.Format("Listening on http://localhost:{0}", Port));
            Console.WriteLine("Endpoints: POST /qbxml, POST /batch, GET /status, POST /close");
            Console.WriteLine("Press Ctrl+C to stop.");

            var cts = new CancellationTokenSource();
            Console.CancelKeyPress += delegate(object s, ConsoleCancelEventArgs e)
            {
                e.Cancel = true;
                cts.Cancel();
                listener.Stop();
            };

            while (!cts.IsCancellationRequested)
            {
                try
                {
                    var context = listener.GetContext();
                    ThreadPool.QueueUserWorkItem(delegate { HandleRequest(context); });
                }
                catch (HttpListenerException)
                {
                    if (cts.IsCancellationRequested) break;
                }
            }

            _connection.Dispose();
            Console.WriteLine("Stopped.");
        }

        static void HandleRequest(HttpListenerContext context)
        {
            var req = context.Request;
            var res = context.Response;

            string origin = req.Headers["Origin"];
            if (!IsLocalOrigin(origin) && !IsLocalHost(req.Url.Host))
            {
                res.StatusCode = 403;
                res.Close();
                return;
            }

            if (origin != null && IsLocalOrigin(origin))
            {
                res.Headers.Add("Access-Control-Allow-Origin", origin);
                res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
            }

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 204;
                res.Close();
                return;
            }

            try
            {
                string path = req.Url.AbsolutePath.ToLowerInvariant();

                if (path == "/status" && req.HttpMethod == "GET")
                {
                    HandleStatus(res);
                }
                else if (path == "/qbxml" && req.HttpMethod == "POST")
                {
                    HandleQBXML(req, res);
                }
                else if (path == "/batch" && req.HttpMethod == "POST")
                {
                    HandleBatch(req, res);
                }
                else if (path == "/close" && req.HttpMethod == "POST")
                {
                    HandleClose(res);
                }
                else
                {
                    SendJson(res, 404, "{\"error\":\"Not found\"}");
                }
            }
            catch (Exception ex)
            {
                SendJson(res, 500, "{\"error\":\"" + Escape(ex.Message) + "\"}");
            }
        }

        static void HandleStatus(HttpListenerResponse res)
        {
            bool connected = _connection.IsConnected;
            string json = "{\"connected\":" + connected.ToString().ToLower() + ",\"port\":" + Port + "}";
            SendJson(res, 200, json);
        }

        static void HandleQBXML(HttpListenerRequest req, HttpListenerResponse res)
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

            if (!_connection.IsConnected)
            {
                _connection.Connect();
            }

            string response = _connection.ProcessRequest(body);
            SendXml(res, 200, response);
        }

        static void HandleBatch(HttpListenerRequest req, HttpListenerResponse res)
        {
            string body;
            using (var reader = new StreamReader(req.InputStream, req.ContentEncoding))
            {
                body = reader.ReadToEnd();
            }

            var requests = body.Split(new[] { "\n---\n" }, StringSplitOptions.RemoveEmptyEntries);
            if (requests.Length == 0)
            {
                SendJson(res, 400, "{\"error\":\"No requests in batch\"}");
                return;
            }

            if (!_connection.IsConnected)
            {
                _connection.Connect();
            }

            var sb = new StringBuilder();
            sb.Append("[");
            for (int i = 0; i < requests.Length; i++)
            {
                string xml = requests[i].Trim();
                if (string.IsNullOrEmpty(xml)) continue;

                try
                {
                    string response = _connection.ProcessRequest(xml);
                    sb.Append("{\"index\":" + i + ",\"success\":true,\"response\":\"" + Escape(response) + "\"}");
                }
                catch (Exception ex)
                {
                    sb.Append("{\"index\":" + i + ",\"success\":false,\"error\":\"" + Escape(ex.Message) + "\"}");
                }

                if (i < requests.Length - 1) sb.Append(",");
            }
            sb.Append("]");

            SendJson(res, 200, sb.ToString());
        }

        static void HandleClose(HttpListenerResponse res)
        {
            _connection.Dispose();
            SendJson(res, 200, "{\"closed\":true}");
        }

        static void SendJson(HttpListenerResponse res, int status, string body)
        {
            res.StatusCode = status;
            res.ContentType = "application/json";
            byte[] bytes = Encoding.UTF8.GetBytes(body);
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        }

        static void SendXml(HttpListenerResponse res, int status, string body)
        {
            res.StatusCode = status;
            res.ContentType = "application/xml";
            byte[] bytes = Encoding.UTF8.GetBytes(body);
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        }

        static string Escape(string s)
        {
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "");
        }

        static bool IsLocalOrigin(string origin)
        {
            if (string.IsNullOrEmpty(origin)) return false;
            Uri uri;
            if (!Uri.TryCreate(origin, UriKind.Absolute, out uri)) return false;
            return IsLocalHost(uri.Host);
        }

        static bool IsLocalHost(string host)
        {
            return host == "localhost" || host == "127.0.0.1" || host == "::1";
        }
    }
}
