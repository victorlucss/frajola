document.addEventListener("DOMContentLoaded", () => {
  const owner = "victorlucss";
  const repo = "frajola";
  const releasePage = `https://github.com/${owner}/${repo}/releases/latest`;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  const note = document.getElementById("download-note");

  const platformConfigs = [
    {
      key: "macos-arm",
      matcher: (name) =>
        name.endsWith(".dmg") && (name.includes("aarch64") || name.includes("arm64")),
    },
    {
      key: "macos-intel",
      matcher: (name) =>
        name.endsWith(".dmg") &&
        (name.includes("x86_64") || name.includes("x64") || name.includes("amd64")),
    },
    {
      key: "windows",
      matcher: (name) => name.endsWith(".msi") || name.endsWith(".exe"),
    },
    {
      key: "linux",
      matcher: (name) => name.endsWith(".appimage"),
    },
  ];

  const cards = platformConfigs
    .map((config) => ({
      ...config,
      el: document.querySelector(`[data-release-platform="${config.key}"]`),
    }))
    .filter((config) => config.el);

  cards.forEach((card) => {
    card.el.setAttribute("href", releasePage);
  });

  const renderNote = (text, linkHref, linkText, suffix = "") => {
    if (!note) return;
    note.textContent = "";
    const prefixNode = document.createTextNode(text);
    note.appendChild(prefixNode);
    const link = document.createElement("a");
    link.href = linkHref;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = linkText;
    note.appendChild(link);
    if (suffix) {
      note.appendChild(document.createTextNode(suffix));
    }
  };

  const pickAsset = (assets, matcher) =>
    assets.find((asset) => matcher(asset.name.toLowerCase()));

  const formatDate = (raw) => {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const resolveLatest = async () => {
    try {
      const response = await fetch(apiUrl, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) {
        throw new Error(`GitHub API responded ${response.status}`);
      }

      const release = await response.json();
      const assets = Array.isArray(release.assets) ? release.assets : [];
      let directLinks = 0;

      cards.forEach((card) => {
        const asset = pickAsset(assets, card.matcher);
        if (!asset) {
          card.el.setAttribute("href", release.html_url || releasePage);
          return;
        }

        card.el.setAttribute("href", asset.browser_download_url);
        card.el.setAttribute("title", `Download ${asset.name}`);
        directLinks += 1;
      });

      const releasedOn = formatDate(release.published_at);
      const suffix =
        releasedOn !== null
          ? ` published on ${releasedOn}.`
          : ".";

      if (directLinks > 0) {
        renderNote(
          "Latest build: ",
          release.html_url || releasePage,
          release.tag_name || "GitHub Release",
          suffix
        );
      } else {
        renderNote(
          "Direct asset matching failed. Open ",
          release.html_url || releasePage,
          "latest release",
          " and pick your installer manually."
        );
      }
    } catch (error) {
      console.warn("Could not resolve latest release assets", error);
      renderNote(
        "Could not auto-resolve assets. Open ",
        releasePage,
        "latest release",
        " and download your platform package."
      );
    }
  };

  resolveLatest();
});
