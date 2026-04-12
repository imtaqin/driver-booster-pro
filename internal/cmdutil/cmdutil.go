package cmdutil

import (
	"os/exec"
	"syscall"
)

// HiddenCommand creates an exec.Cmd that runs without showing a console window.
// This prevents PowerShell/cmd flashing when the app runs as a GUI application.
func HiddenCommand(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	return cmd
}
