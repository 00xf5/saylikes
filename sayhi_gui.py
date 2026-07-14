"""
Simple non-techy launcher for the SayHi like bot.
Requires: phone USB + Appium running (use Start Appium button or start_appium.ps1).
"""

from __future__ import annotations

import queue
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

import sayhi_bot

ROOT = Path(__file__).resolve().parent
APPIUM_PS1 = ROOT / "start_appium.ps1"
ADB = Path(r"C:\platform-tools\adb.exe")


class TextRedirect:
    def __init__(self, q: queue.Queue):
        self.q = q

    def write(self, s: str) -> int:
        if s:
            self.q.put(s)
        return len(s)

    def flush(self) -> None:
        pass


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("SayHi Likes")
        self.geometry("420x520")
        self.minsize(380, 480)
        self.configure(padx=16, pady=16)

        self.stop_flag = threading.Event()
        self.worker: threading.Thread | None = None
        self.log_q: queue.Queue = queue.Queue()

        self._build()
        self.after(120, self._drain_log)
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build(self) -> None:
        hdr = ttk.Label(self, text="SayHi Likes", font=("Segoe UI", 18, "bold"))
        hdr.pack(anchor="w")
        ttk.Label(
            self,
            text="Plug phone in · USB debugging on · Appium running · then Start",
            wraplength=380,
        ).pack(anchor="w", pady=(4, 14))

        form = ttk.Frame(self)
        form.pack(fill="x")

        ttk.Label(form, text="How many likes").grid(row=0, column=0, sticky="w", pady=6)
        self.max_var = tk.IntVar(value=20)
        ttk.Spinbox(form, from_=1, to=200, textvariable=self.max_var, width=8).grid(
            row=0, column=1, sticky="e", pady=6
        )

        ttk.Label(form, text="Active within").grid(row=1, column=0, sticky="w", pady=6)
        self.login_var = tk.StringVar(value="15 minutes")
        ttk.Combobox(
            form,
            textvariable=self.login_var,
            values=["15 minutes", "1 hour", "1 day", "3 days"],
            state="readonly",
            width=14,
        ).grid(row=1, column=1, sticky="e", pady=6)

        ttk.Label(form, text="Speed").grid(row=2, column=0, sticky="w", pady=6)
        self.speed_var = tk.StringVar(value="Fast")
        ttk.Combobox(
            form,
            textvariable=self.speed_var,
            values=["Fast", "Normal", "Slow"],
            state="readonly",
            width=14,
        ).grid(row=2, column=1, sticky="e", pady=6)

        self.skip_search_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            form,
            text="Already searched (skip filter)",
            variable=self.skip_search_var,
        ).grid(row=3, column=0, columnspan=2, sticky="w", pady=6)

        form.columnconfigure(0, weight=1)

        btns = ttk.Frame(self)
        btns.pack(fill="x", pady=(12, 8))
        self.start_btn = ttk.Button(btns, text="Start", command=self._start)
        self.start_btn.pack(side="left", expand=True, fill="x", padx=(0, 6))
        self.stop_btn = ttk.Button(btns, text="Stop", command=self._stop, state="disabled")
        self.stop_btn.pack(side="left", expand=True, fill="x", padx=(6, 0))

        ttk.Button(self, text="Start Appium (leave window open)", command=self._start_appium).pack(
            fill="x", pady=(0, 4)
        )
        ttk.Button(self, text="Check phone connection", command=self._check_phone).pack(fill="x")

        self.status = ttk.Label(self, text="Ready", foreground="#166534")
        self.status.pack(anchor="w", pady=(12, 4))

        ttk.Label(self, text="Log").pack(anchor="w")
        self.log = tk.Text(self, height=12, wrap="word", state="disabled")
        self.log.pack(fill="both", expand=True, pady=(4, 0))

    def _speed_delays(self) -> tuple[float, float]:
        return {
            "Fast": (0.25, 0.55),
            "Normal": (1.0, 2.0),
            "Slow": (2.0, 4.0),
        }.get(self.speed_var.get(), (0.25, 0.55))

    def _append_log(self, s: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", s)
        self.log.see("end")
        self.log.configure(state="disabled")

    def _drain_log(self) -> None:
        try:
            while True:
                self._append_log(self.log_q.get_nowait())
        except queue.Empty:
            pass
        self.after(120, self._drain_log)

    def _start_appium(self) -> None:
        # Open a new PowerShell that keeps Appium running
        cmd = [
            "powershell",
            "-NoExit",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(APPIUM_PS1),
        ]
        subprocess.Popen(cmd, cwd=str(ROOT))
        self.status.configure(text="Appium window opened — wait until it says ready")
        self._append_log("\n[app] launched start_appium.ps1\n")

    def _check_phone(self) -> None:
        try:
            out = subprocess.check_output([str(ADB), "devices"], text=True, timeout=20)
        except Exception as e:
            messagebox.showerror("Phone check", str(e))
            return
        lines = [ln for ln in out.splitlines() if "\tdevice" in ln]
        if lines:
            messagebox.showinfo("Phone check", f"Connected:\n{lines[0]}")
            self.status.configure(text="Phone connected")
        else:
            messagebox.showwarning(
                "Phone check",
                "No phone found.\nUnlock phone, enable USB debugging, accept the prompt.",
            )
            self.status.configure(text="Phone not connected")

    def _start(self) -> None:
        if self.worker and self.worker.is_alive():
            return
        self.stop_flag.clear()
        self.start_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")
        self.status.configure(text="Running… keep SayHi open on the phone")
        dmin, dmax = self._speed_delays()
        max_likes = int(self.max_var.get())
        login = self.login_var.get()
        skip = bool(self.skip_search_var.get())

        def job() -> None:
            old_out, old_err = sys.stdout, sys.stderr
            sys.stdout = sys.stderr = TextRedirect(self.log_q)
            try:
                stats = sayhi_bot.run_bot(
                    max_likes=max_likes,
                    delay_min=dmin,
                    delay_max=dmax,
                    login_within=login,
                    skip_search=skip,
                    stop_flag=self.stop_flag,
                )
                self.log_q.put(
                    f"\nFinished: liked={stats.liked} missed={stats.missed_like} "
                    f"errors={stats.errors}\n"
                )
            except SystemExit as e:
                self.log_q.put(f"\nStopped: {e}\n")
            except Exception as e:
                self.log_q.put(f"\nERROR: {e}\n")
            finally:
                sys.stdout, sys.stderr = old_out, old_err
                self.after(0, self._finished)

        self.worker = threading.Thread(target=job, daemon=True)
        self.worker.start()

    def _finished(self) -> None:
        self.start_btn.configure(state="normal")
        self.stop_btn.configure(state="disabled")
        self.status.configure(text="Ready")

    def _stop(self) -> None:
        self.stop_flag.set()
        self.status.configure(text="Stopping after current profile…")
        self._append_log("\n[app] stop requested\n")

    def _on_close(self) -> None:
        self.stop_flag.set()
        self.destroy()


if __name__ == "__main__":
    App().mainloop()
