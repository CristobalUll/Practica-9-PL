#!/usr/bin/env python3
"""
Control de Bluetooth propio: desconectar dispositivos o apagar el adaptador.
Requiere bluetoothctl (Linux) o ADB (Android via USB).
"""

import subprocess
import sys


# ── Linux / bluetoothctl ──────────────────────────────────────────────────────

def bt_run(*args):
    result = subprocess.run(
        ["bluetoothctl"] + list(args),
        capture_output=True, text=True
    )
    return result.stdout.strip()


def list_connected():
    output = bt_run("devices", "Connected")
    devices = []
    for line in output.splitlines():
        parts = line.split(" ", 2)
        if len(parts) == 3 and parts[0] == "Device":
            devices.append({"mac": parts[1], "name": parts[2]})
    return devices


def disconnect(mac: str):
    return bt_run("disconnect", mac)


def power(state: str):
    """state: 'on' | 'off'"""
    return bt_run("power", state)


# ── Android via ADB ───────────────────────────────────────────────────────────

def adb_run(*args):
    result = subprocess.run(
        ["adb"] + list(args),
        capture_output=True, text=True
    )
    return result.stdout.strip() or result.stderr.strip()


def adb_bt_off():
    return adb_run("shell", "svc", "bluetooth", "disable")


def adb_bt_on():
    return adb_run("shell", "svc", "bluetooth", "enable")


def adb_list_devices():
    """Lista dispositivos ADB conectados al PC."""
    return adb_run("devices")


# ── CLI ───────────────────────────────────────────────────────────────────────

MENU = """
=== Control Bluetooth ===
1. Listar dispositivos BT conectados (Linux)
2. Desconectar un dispositivo     (Linux)
3. Apagar adaptador BT            (Linux)
4. Encender adaptador BT          (Linux)
5. Apagar BT en móvil Android     (ADB)
6. Encender BT en móvil Android   (ADB)
7. Ver dispositivos ADB           (ADB)
0. Salir
"""

def main():
    while True:
        print(MENU)
        choice = input("Elige opción: ").strip()

        if choice == "0":
            break

        elif choice == "1":
            devices = list_connected()
            if not devices:
                print("Sin dispositivos conectados.")
            for d in devices:
                print(f"  {d['mac']}  {d['name']}")

        elif choice == "2":
            devices = list_connected()
            if not devices:
                print("Sin dispositivos conectados.")
                continue
            for i, d in enumerate(devices):
                print(f"  [{i}] {d['name']} ({d['mac']})")
            idx = input("Índice del dispositivo: ").strip()
            if idx.isdigit() and int(idx) < len(devices):
                print(disconnect(devices[int(idx)]["mac"]))

        elif choice == "3":
            print(power("off"))

        elif choice == "4":
            print(power("on"))

        elif choice == "5":
            print(adb_bt_off())

        elif choice == "6":
            print(adb_bt_on())

        elif choice == "7":
            print(adb_list_devices())

        else:
            print("Opción no válida.")


if __name__ == "__main__":
    main()
