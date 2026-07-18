' Launches the ZotSnap server without a console window.
' A copy of this file lives in the user's Startup folder so it runs at every logon.
CreateObject("WScript.Shell").Run "node ""C:\Users\alano\Projects\ZotSnap\host\server.js""", 0, False
