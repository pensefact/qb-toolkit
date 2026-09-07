using System;
using System.Windows.Forms;

namespace QBDesktop
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string companyFile = args.Length > 0 ? args[0] : "";
            Application.Run(new MainForm(companyFile));
        }
    }
}
