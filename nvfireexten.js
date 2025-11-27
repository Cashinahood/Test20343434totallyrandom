class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  getPreference(key) {
    return new SharedPreferences().get(key);
  }

  getHeaders(url) {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "text/html,application/xhtml+xml",
      "Referer": this.source.baseUrl + "/",
    };
  }

  async request(slug) {
    const url = `${this.source.baseUrl}${slug}`;
    const res = await this.client.get(url, { headers: this.getHeaders(url) });
    return new Document(res.body);
  }

  // -----------------------------
  // SEARCH FIXED
  // -----------------------------
  async searchPage({
    query = "",
    genres = [],
    status = "all",
    sort = "new",
    page = 1
  } = {}) {

    let slug = "";

    if (query) {
      slug = `/search?keyword=${encodeURIComponent(query)}&page=${page}`;
    } else {
      // real filter browsing URL used by Novelfire
      slug = `/novels?sort=${sort}&status=${status}&page=${page}`;
      if (genres.length > 0) {
        for (let g of genres) slug += `&genre=${g}`;
      }
    }

    const doc = await this.request(slug);
    const list = [];

    // FIXED SELECTOR
    doc.select("#book-list .book-item").forEach(item => {
      const a = item.selectFirst("a");
      if (!a) return;

      const link = a.attr("href");
      const name = a.attr("title") || a.text.trim();

      let imageUrl = "";
      const img = a.selectFirst("img");
      if (img) {
        imageUrl = img.attr("data-src") || img.attr("src") || "";
      }

      list.push({ name, link, imageUrl });
    });

    const next = doc.selectFirst(".pagination .next a");
    const hasNextPage = next !== null;

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return this.searchPage({ sort: "popular", page });
  }

  async getLatestUpdates(page) {
    return this.searchPage({ sort: "new", page });
  }

  async search(query, page, filters) {
    if (query) return this.searchPage({ query, page });

    function getBox(state) {
      return state.filter(i => i.state).map(i => i.value);
    }
    const genres = filters ? getBox(filters[0].state) : [];

    function getSelect(filter) {
      return filter.values[filter.state].value;
    }
    const status = filters ? getSelect(filters[1]) : "all";
    const sort = filters ? getSelect(filters[2]) : "new";

    return this.searchPage({ genres, status, sort, page });
  }

  // -----------------------------
  // DETAILS — unchanged except fixes
  // -----------------------------
  async getDetail(url) {
    const slug = url.replace(this.source.baseUrl, "");
    const doc = await this.request(slug);

    const name = doc.selectFirst("h1.novel-title").text.trim();

    const img = doc.selectFirst(".novel-cover img");
    const imageUrl = img ? img.attr("data-src") : "";

    // description fix (matches site)
    let description = "";
    doc.select(".content.expand-wrapper p").forEach(p => {
      description += p.text.trim() + " ";
    });
    description = description.trim();

    const genre = [];
    doc.select(".categories a.property-item").forEach(a =>
      genre.push(a.text.trim())
    );

    let status = 5;
    const st = doc.selectFirst("strong.ongoing, strong.completed");
    if (st) {
      const s = st.text.trim();
      status = s === "Ongoing" ? 0 : s === "Completed" ? 1 : 5;
    }

    // chapters page is correct, but "getHref" → attr("href")
    const chapters = [];
    const chaptersPage = doc.selectFirst("a.chapter-latest-container");
    if (chaptersPage) {
      const chapLink = chaptersPage.attr("href");
      const chapDoc = await this.request(chapLink.replace(this.source.baseUrl, ""));

      chapDoc.select(".chapter-list a").forEach(ch => {
        chapters.push({
          name: ch.attr("title") || ch.text.trim(),
          url: ch.attr("href"),
          dateUpload: ""
        });
      });
    }

    return {
      name,
      imageUrl,
      description,
      link: url,
      status,
      genre,
      chapters
    };
  }

  async getHtmlContent(name, url) {
    const doc = await this.request(url.replace(this.source.baseUrl, ""));
    return this.cleanHtmlContent(doc);
  }

  async cleanHtmlContent(doc) {
    const div = doc.selectFirst("#content");
    if (!div) return "";

    const title = div.selectFirst("h4")?.text.trim() ?? "";

    let content = "";
    div.select("p").forEach(p => {
      const text = p.text.trim();
      if (
        text &&
        !text.includes("novelfire.net") &&
        !/disable-blocker/i.test(text)
      ) {
        content += text + "<br><br>";
      }
    });

    return `<h2>${title}</h2><hr><br>${content}`;
  }

  getFilterList() {
    return [
      {
        type_name: "GroupFilter",
        name: "Genres",
        state: [] // keep as-is or fill from API
      },
      {
        type_name: "SelectFilter",
        name: "Status",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "All", value: "all" },
          { type_name: "SelectOption", name: "Ongoing", value: "ongoing" },
          { type_name: "SelectOption", name: "Completed", value: "completed" }
        ]
      },
      {
        type_name: "SelectFilter",
        name: "Order by",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "New", value: "new" },
          { type_name: "SelectOption", name: "Popular", value: "popular" },
          { type_name: "SelectOption", name: "Rating", value: "rating" },
          { type_name: "SelectOption", name: "Name", value: "name" },
          { type_name: "SelectOption", name: "Views", value: "views" }
        ]
      }
    ];
  }

  getSourcePreferences() {
    return [];
  }
}
