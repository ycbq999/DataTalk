"""Deploy a previously verified image to Render, wait for it, and smoke-test it."""

import json
import os
import re
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from smoke import normalize_origin, smoke_check


RUNNING = {"created", "queued", "build_in_progress", "pre_deploy_in_progress", "update_in_progress"}
TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}


def render_request(path, token, data=None):
    body = json.dumps(data).encode("utf-8") if data is not None else None
    request = Request(
        "https://api.render.com/v1/" + path,
        data=body,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=20) as response:
        return json.load(response)


def deploy(service_id, image, token):
    path = f"services/{service_id}/deploys"
    deployment = render_request(path, token, {"imageUrl": image})
    deploy_id = deployment["id"]
    if not re.fullmatch(r"dep-[a-z0-9]+", deploy_id):
        raise ValueError("Render returned an unexpected deployment ID.")
    print(f"Started {deploy_id} on {service_id}", flush=True)
    deadline = time.monotonic() + 19 * 60
    last_status = None
    while time.monotonic() < deadline:
        try:
            deployment = render_request(f"{path}/{deploy_id}", token)
        except HTTPError as exc:
            if exc.code not in TRANSIENT_STATUS_CODES:
                raise
        except (URLError, TimeoutError):
            pass
        else:
            status = deployment["status"]
            if status != last_status:
                print(f"{deploy_id}: {status}", flush=True)
                last_status = status
            if status == "live":
                resolved = deployment["image"]
                resolved_sha = resolved.get("sha") or resolved["ref"].rpartition("@")[2]
                if resolved_sha.removeprefix("sha256:") != image.rpartition(":")[2]:
                    raise RuntimeError(f"Render deploy {deploy_id} resolved to a different image digest.")
                return deploy_id
            if status not in RUNNING:
                raise RuntimeError(f"Render deploy {deploy_id} did not go live ({status}).")
        time.sleep(12)
    raise TimeoutError(f"Timed out waiting for {deploy_id}. Check Render before retrying.")


def main():
    token = os.environ.get("RENDER_API_KEY", "")
    web = os.environ.get("RENDER_WEB_SERVICE_ID", "")
    worker = os.environ.get("RENDER_WORKER_SERVICE_ID", "")
    url = os.environ.get("DATATALK_URL", "")
    image = os.environ["RELEASE_IMAGE"]
    if not token or not url.startswith("https://"):
        raise ValueError("Set the Render API token and deployed HTTPS URL before releasing.")
    url = normalize_origin(url)
    if not re.fullmatch(r"srv-[a-z0-9]+", web) or (
        worker and (worker == web or not re.fullmatch(r"srv-[a-z0-9]+", worker))
    ):
        raise ValueError("Set distinct valid Render web and optional worker service IDs.")

    # The web service's Render pre-deploy command migrates the schema first.
    web_deploy = deploy(web, image, token)
    smoke_check(url)
    worker_deploy = deploy(worker, image, token) if worker else None

    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(summary, "a", encoding="utf-8") as file:
            file.write(f"Image: `{image}`\n\nWeb deploy: `{web_deploy}`\n")
            if worker_deploy:
                file.write(f"\nWorker deploy: `{worker_deploy}`\n")


if __name__ == "__main__":
    main()
