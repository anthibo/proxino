import sys
from pathlib import Path
import proxino.paths as paths

def _mk(dirpath: Path) -> Path:
    dirpath.mkdir(parents=True)
    (dirpath / "index.html").write_text("<html></html>")
    return dirpath

def test_frozen_bundle_wins(tmp_path, monkeypatch):
    frozen = _mk(tmp_path / "meipass" / "web" / "dist")
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path / "meipass"), raising=False)
    assert paths.web_dist() == frozen
    assert paths.addon_path() == tmp_path / "meipass" / "proxino" / "addon.py"

def test_repo_dist_when_not_frozen(monkeypatch):
    monkeypatch.delattr(sys, "frozen", raising=False)
    monkeypatch.delattr(sys, "_MEIPASS", raising=False)
    repo_dist = Path(paths.__file__).resolve().parent.parent / "web" / "dist"
    if (repo_dist / "index.html").exists():
        assert paths.web_dist() == repo_dist
    assert paths.addon_path() == Path(paths.__file__).resolve().parent / "addon.py"

def test_package_data_fallback(tmp_path, monkeypatch):
    monkeypatch.delattr(sys, "frozen", raising=False)
    fake_pkg = tmp_path / "proxino"
    fake_pkg.mkdir()
    wheel_dist = _mk(fake_pkg / "web_dist")
    monkeypatch.setattr(paths, "_PKG_DIR", fake_pkg)
    assert paths.web_dist() == wheel_dist

def test_none_when_nothing_exists(tmp_path, monkeypatch):
    monkeypatch.delattr(sys, "frozen", raising=False)
    monkeypatch.setattr(paths, "_PKG_DIR", tmp_path / "proxino")
    assert paths.web_dist() is None
