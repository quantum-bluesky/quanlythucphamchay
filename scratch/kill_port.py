import socket
import os
import signal
import sys

def get_pid_on_port(port):
    import subprocess
    try:
        output = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True).decode()
        for line in output.strip().split("\n"):
            if "LISTENING" in line:
                parts = line.strip().split()
                pid = parts[-1]
                return int(pid)
    except Exception:
        pass
    return None

pid = get_pid_on_port(8130)
if pid:
    print(f"Process {pid} is running on port 8130. Killing it...")
    try:
        os.kill(pid, signal.SIGTERM)
        print("Killed process successfully.")
    except Exception as e:
        print(f"Failed to kill: {e}")
        try:
            os.system(f"taskkill /F /PID {pid}")
            print("Force killed process.")
        except Exception as e2:
            print(f"Force kill failed: {e2}")
else:
    print("Port 8130 is free.")
