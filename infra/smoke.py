"""Check that the deployed Django service can serve the API and React build."""

import json
import sys
import time
from html.parser import HTMLParser
from urllib.parse import urlsplit
from urllib.request import urlopen


class DashboardAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.styles = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("type") == "module" and attrs.get("src"):
            self.scripts.append(attrs["src"])
        if tag == "link" and attrs.get("rel") == "stylesheet" and attrs.get("href"):
            self.styles.append(attrs["href"])


def get(origin, path):
    with urlopen(origin + path, timeout=8) as response:
        if urlsplit(response.url)[:2] != urlsplit(origin)[:2] or response.status != 200:
            raise ValueError(f"{path} did not return HTTP 200 from the expected origin")
        return response.headers, response.read()


def normalize_origin(url):
    parsed = urlsplit(url)
    local_http = parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}
    if (
        (parsed.scheme != "https" and not local_http)
        or not parsed.netloc
        or parsed.username
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Provide an HTTPS origin or a local HTTP origin.")
    return url.rstrip("/")


def smoke_check(url):
    origin = normalize_origin(url)
    deadline = time.monotonic() + 90
    while True:
        try:
            _, ready = get(origin, "/api/v1/ready/")
            break
        except OSError:
            if time.monotonic() >= deadline:
                raise
            time.sleep(2)

    if json.loads(ready).get("status") != "ok":
        raise ValueError("The readiness endpoint did not report 'ok'.")

    _, health = get(origin, "/api/v1/health/")
    if json.loads(health).get("status") != "ok":
        raise ValueError("The health endpoint did not report 'ok'.")

    session_headers, session = get(origin, "/api/v1/session/")
    if json.loads(session) != {"user": None}:
        raise ValueError("The session endpoint did not return a signed-out session.")
    if not any(cookie.startswith("csrftoken=") for cookie in session_headers.get_all("Set-Cookie", [])):
        raise ValueError("The session endpoint did not set the CSRF cookie.")

    _, document = get(origin, "/")
    parser = DashboardAssets()
    parser.feed(document.decode("utf-8"))
    if not parser.scripts:
        raise ValueError("The dashboard does not reference a built module script.")
    for path in parser.scripts + parser.styles:
        if not path.startswith("/static/assets/"):
            raise ValueError("The dashboard references an asset outside its expected static path.")
        headers, asset = get(origin, path)
        media_type = headers.get_content_type()
        expected_types = {"text/javascript", "application/javascript"} if path in parser.scripts else {"text/css"}
        if not asset or media_type not in expected_types:
            raise ValueError(f"The built asset {path} has an unexpected response type.")

    print(f"Verified readiness, API, signed-out session, and dashboard assets at {origin}")


if __name__ == "__main__":
    smoke_check(sys.argv[1])
