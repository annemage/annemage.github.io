(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  // --- Scroll-spy navigation -------------------------------------------
  var sections = Array.prototype.slice.call(document.querySelectorAll("main section[id]"));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".site-nav a, .mobile-nav a"));

  function setActive(id) {
    navLinks.forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("href") === "#" + id);
    });
  }

  if ("IntersectionObserver" in window && sections.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    sections.forEach(function (s) { observer.observe(s); });
  }

  // --- Publications ------------------------------------------------------
  var TYPE_LABELS = {
    conference: "Conference",
    journal: "Journal",
    workshop: "Workshop",
    preprint: "Preprint",
    thesis: "Thesis"
  };

  // Only strips "<" / ">" so DBLP's numeric character entities (e.g. for
  // accented names) still decode correctly when inserted via innerHTML,
  // while blocking any stray markup/script tags from being interpreted.
  function sanitize(str) {
    return String(str == null ? "" : str).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function formatAuthors(authors) {
    return authors
      .map(function (a) {
        var safe = sanitize(a);
        return a === "Anne-Marie George" ? "<strong>" + safe + "</strong>" : safe;
      })
      .join(", ");
  }

  function renderPublications(data) {
    var listEl = document.getElementById("pub-list");
    var yearSelect = document.getElementById("year-filter");
    var updatedEl = document.getElementById("pub-updated");
    var statusEl = document.getElementById("pub-status");

    var pubs = (data.publications || []).slice().sort(function (a, b) { return b.year - a.year; });

    if (!pubs.length) {
      listEl.innerHTML = "<p>No publications found.</p>";
      return;
    }

    var years = Array.from(new Set(pubs.map(function (p) { return p.year; }))).sort(function (a, b) { return b - a; });
    years.forEach(function (y) {
      var opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });

    if (data.generated_at) {
      var d = new Date(data.generated_at);
      updatedEl.textContent = isNaN(d) ? data.generated_at : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    }

    function draw(filterYear) {
      listEl.innerHTML = "";
      var byYear = {};
      pubs.forEach(function (p) {
        if (filterYear !== "all" && String(p.year) !== filterYear) return;
        (byYear[p.year] = byYear[p.year] || []).push(p);
      });

      var orderedYears = Object.keys(byYear).sort(function (a, b) { return b - a; });
      if (!orderedYears.length) {
        listEl.innerHTML = "<p>No publications for this year.</p>";
        return;
      }

      orderedYears.forEach(function (y) {
        var group = document.createElement("div");
        group.className = "pub-year-group";
        var heading = document.createElement("h3");
        heading.textContent = y;
        group.appendChild(heading);

        byYear[y].forEach(function (p) {
          var item = document.createElement("div");
          item.className = "pub-item";

          var safeTitle = sanitize(p.title);
          var titleHtml = p.url
            ? '<a href="' + encodeURI(p.url) + '" target="_blank" rel="noopener">' + safeTitle + "</a>"
            : safeTitle;

          var typeLabel = sanitize(TYPE_LABELS[p.type] || p.type || "");

          item.innerHTML =
            '<div class="pub-title">' + titleHtml +
            (typeLabel ? '<span class="pub-type">' + typeLabel + "</span>" : "") +
            "</div>" +
            '<div class="pub-authors">' + formatAuthors(p.authors || []) + "</div>" +
            '<div class="pub-venue">' + sanitize(p.venue || "") + "</div>" +
            (p.highlight ? '<span class="pub-highlight">' + sanitize(p.highlight) + "</span>" : "");

          group.appendChild(item);
        });

        listEl.appendChild(group);
      });
    }

    yearSelect.addEventListener("change", function () { draw(this.value); });
    draw("all");
    statusEl.textContent = pubs.length + " publications";
  }

  fetch("assets/data/publications.json", { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(renderPublications)
    .catch(function (err) {
      var listEl = document.getElementById("pub-list");
      listEl.innerHTML =
        '<p>Could not load the publication list right now. Please see my ' +
        '<a href="https://dblp.org/pid/165/2974.html" target="_blank" rel="noopener">DBLP profile</a> ' +
        'directly.</p>';
      console.error("Failed to load publications.json:", err);
    });
})();
