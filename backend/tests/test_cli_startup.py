"""CLI help must work independently of the HTTP application's credentials."""
import os
from pathlib import Path
import subprocess
import sys


BACKEND = Path(__file__).resolve().parents[1]


def test_cli_help_without_api_credentials_or_database(tmp_path):
    env = os.environ.copy()
    for name in ("JWT_SECRET_KEY", "TMDB_API_KEY", "ALEMBIC_DATABASE_URL"):
        env.pop(name, None)
    env["PYTHONPATH"] = str(BACKEND)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    output_path = tmp_path / "cli-help.txt"
    # Use real files rather than captured pipes, unsupported by this sandbox.
    with output_path.open("w", encoding="utf-8") as output:
        result = subprocess.run(
            [sys.executable, "-m", "app.cli", "--help"],
            cwd=tmp_path,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=output,
            stderr=subprocess.STDOUT,
            timeout=20,
            check=False,
        )
    help_text = output_path.read_text(encoding="utf-8")
    assert result.returncode == 0, help_text
    assert "create-superuser" in help_text
    assert "promote-superuser" in help_text
    assert "Traceback" not in help_text
    assert not (tmp_path / "webapp_filmes.db").exists()
