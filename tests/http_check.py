#!/usr/bin/env python3
"""End-to-end checks against tests/http_fixture.php on a local test server."""
import json
import os
import urllib.error
import urllib.request

BASE = os.environ.get("TC_TEST_URL", "http://127.0.0.1:18090/")
TAB = "a" * 32
TOKEN = "fixture-token"


def post(op, values=None, image=None, user=1, token=TOKEN, tab=TAB, limits=None):
    fields = {"_op": op, "_tab": tab, "_token": token, **(values or {})}
    boundary = "tc-boundary-123456789"
    pieces = []
    for key, value in fields.items():
        pieces.append((f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n").encode())
    if image is not None:
        pieces.append((f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"test.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n").encode())
        pieces.append(image + b"\r\n")
    pieces.append(f"--{boundary}--\r\n".encode())
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}", "X-Test-User": str(user)}
    headers.update(limits or {})
    request = urllib.request.Request(BASE, b"".join(pieces), headers=headers)
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def get_image(image_id, user=1, tab=""):
    url = BASE + "?op=image&_id=" + image_id + ("&_tab=" + tab if tab else "")
    request = urllib.request.Request(url, headers={"X-Test-User": str(user)})
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, response.headers.get("Content-Type"), response.read()[:3]
    except urllib.error.HTTPError as error:
        return error.code, None, b""


def check(condition, name):
    assert condition, name
    print("OK:", name)


invalid = b"<html>not an image</html>"
status, data = post("upload", image=invalid)
check(status == 400 and data["code"] == "invalid_file", "non-image rejected")
status, data = post("upload", image=invalid, token="bad")
check(status == 403 and data["code"] == "csrf", "invalid CSRF rejected")

image_path = os.environ["TC_TEST_IMAGE"]
with open(image_path, "rb") as stream:
    image = stream.read()
status, data = post("upload", image=image, limits={"X-Test-Max-File": "100"})
check(status == 400 and data["code"] == "image_too_large", "input file limit enforced")
status, data = post("upload", image=image)
check(status == 200 and data["ok"], "real image accepted")
image_id = data["image"]["id"]
check(get_image(image_id, user=2, tab=TAB)[0] == 404, "other user cannot read pending image")
check(get_image(image_id, user=1, tab=TAB)[0] == 200, "owner can preview pending image")

settings = {"v": 1, "rev": "", "preset": "custom", "background": image_id,
            "mode": "dark", "accent": "#8c79dc", "surface": 92, "radius": 12,
            "text": 14, "density": "normal", "dim": 0, "blur": 0,
            "fit": "cover", "position": "center", "fill": "#e8edf3"}
bad_settings = dict(settings, accent="red")
status, data = post("save", {"_settings": json.dumps(bad_settings), "_remove": "[]", "_discard": "[]"})
check(status == 400 and data["code"] == "invalid_settings", "invalid settings do not commit")
check(get_image(image_id, user=1, tab=TAB)[0] == 200, "failed Save retains pending preview")
status, data = post("save", {"_settings": json.dumps(settings), "_remove": "[]", "_discard": "[]"})
check(status == 200 and data["settings"]["background"] == image_id, "settings and file committed")
revision = data["settings"]["rev"]
check(len(revision) == 32 and get_image(image_id)[0] == 200, "saved image survives without tab token")
check(get_image(image_id, user=2)[0] == 404, "other user cannot read saved image")

status, data = post("save", {"_settings": json.dumps(settings), "_remove": "[]", "_discard": "[]"})
check(status == 409 and data["code"] == "conflict", "stale revision rejected")
settings["rev"] = revision
settings["background"] = "none"
status, data = post("save", {"_settings": json.dumps(settings), "_remove": json.dumps([image_id]), "_discard": "[]"})
check(status == 200 and get_image(image_id)[0] == 404, "queued deletion commits on Save")

status, data = post("upload", image=image, limits={"X-Test-Max-Images": "1"})
check(status == 200, "first upload within quota accepted")
temporary = data["image"]["id"]
status, data = post("upload", image=image, limits={"X-Test-Max-Images": "1"})
check(status == 409 and data["code"] == "quota", "image count quota enforced")
status, data = post("cancel")
check(status == 200 and get_image(temporary, tab=TAB)[0] == 404, "Cancel removes temporary image")

other_tab = "b" * 32
status, data = post("upload", image=image, tab=other_tab)
check(status == 200, "second tab can upload")
other_image = data["image"]["id"]
post("cancel", tab=TAB)
check(get_image(other_image, tab=other_tab)[0] == 200, "Cancel does not remove another tab's upload")
post("cancel", tab=other_tab)

builtin = dict(settings, rev="", preset="forest", background="forest", mode="light", accent="#327d66")
status, data = post("save", {"_settings": json.dumps(builtin), "_remove": "[]", "_discard": "[]"},
                    user=2, limits={"X-Test-No-Storage": "1"})
check(status == 200 and data["settings"]["background"] == "forest", "built-in theme saves without image storage")
status, data = post("upload", image=image, user=2, limits={"X-Test-No-Storage": "1"})
check(status == 503 and data["code"] == "storage_unconfigured", "upload explains missing storage")

print("HTTP fixture completed")
