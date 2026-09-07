using System;

namespace QBBridge
{
    /// <summary>
    /// Wraps the QBXMLRP2.RequestProcessor COM object for communicating with QuickBooks Desktop.
    /// Manages connection lifecycle and session state.
    /// </summary>
    class QBConnection : IDisposable
    {
        private readonly string _companyFile;
        private dynamic _rp;
        private string _ticket;
        private bool _connected;

        private const string AppName = "QB Toolkit Bridge";
        private const string AppId = "QBToolkit";

        public bool IsConnected => _connected;

        public QBConnection(string companyFile = "")
        {
            _companyFile = companyFile;
        }

        public void Connect()
        {
            if (_connected) return;

            try
            {
                var rpType = Type.GetTypeFromProgID("QBXMLRP2.RequestProcessor");
                if (rpType == null)
                {
                    throw new Exception(
                        "QBXMLRP2.RequestProcessor not found. " +
                        "QuickBooks Desktop must be installed on this machine.");
                }

                _rp = Activator.CreateInstance(rpType);
                _rp.OpenConnection(AppId, AppName);

                // Mode 2 = do not require QB to be open (will use last company file)
                _ticket = _rp.BeginSession(_companyFile, 2);
                _connected = true;

                Console.WriteLine("Connected to QuickBooks.");
            }
            catch (Exception ex)
            {
                _connected = false;
                throw new Exception($"Failed to connect to QuickBooks: {ex.Message}", ex);
            }
        }

        public string ProcessRequest(string qbXml)
        {
            if (!_connected)
            {
                throw new Exception("Not connected to QuickBooks. Call Connect() first.");
            }

            return _rp.ProcessRequest(_ticket, qbXml);
        }

        public void Dispose()
        {
            if (!_connected) return;

            try
            {
                if (_ticket != null)
                {
                    _rp.EndSession(_ticket);
                    _ticket = null;
                }
                _rp.CloseConnection();
                Console.WriteLine("Disconnected from QuickBooks.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error disconnecting: {ex.Message}");
            }

            _connected = false;
        }
    }
}
