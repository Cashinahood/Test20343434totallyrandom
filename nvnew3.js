const novelfireSource = {
  "name": "Novelfire",
  "id": 2507947283,
  "baseUrl": "https://novelfire.net",
  "lang": "en",
  "typeSource": "single",
  "iconUrl": "https://novelfire.net/logo.ico",
  "version": "0.0.3",
  "isManga": false,
  "itemType": 2,
  "isFullData": false,
  "appMinVerReq": "0.5.0",
  "sourceCodeLanguage": 1,
  "pkgPath": "novel/src/en/novelfire.js"
};

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
      "User-Agent": "Mozilla/5.0",
      "Accept": "text/html",
      "Referer": this.source.baseUrl + "/"
    };
  }

  async request(slug, options = {}) {
    const url = `${this.source.baseUrl}${slug}`;
    const res = await this.client.get(url, { headers: this.getHeaders(url), ...options });
    return new Document(res.body);
  }

  // -----------------------
  // SEARCH
  // -----------------------
  async searchPage({ query = "" } = {}) {
    if (!query) return { list: [], hasNextPage: false };

    // AJAX search
    const url = `/ajax/searchLive?inputContent=${encodeURIComponent(query)}`;
    const res = await this.client.get(this.source.baseUrl + url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Referer": this.source.baseUrl + "/"
      }
    });

    const json = JSON.parse(res.body);
    const html = json.html;
    const doc = new Document(html);

    const list = [];
    doc.select("li.novel-item").forEach(item => {
      const a = item.selectFirst("a");
      if (!a) return;

      const link = a.getHref;
      const imageUrl = a.selectFirst("img")?.attr("src") || "";
      const titleEl = a.selectFirst("h4.novel-title");
      const name = titleEl ? titleEl.text.trim() : "No Title";

      list.push({ name, link, imageUrl });
    });

    return { list, hasNextPage: false };
  }

  async search(query, page, filters) {
    return this.searchPage({ query });
  }

  // -----------------------
  // DETAIL PAGE
  // -----------------------
  async getDetail(url) {
    const slug = url.replace(this.source.baseUrl, "");
    const doc = await this.request(slug);

    const name = doc.selectFirst("h1.novel-title")?.text.trim() || "No Title";
    const imageUrl = doc.selectFirst(".novel-cover img")?.attr("data-src") || "";

    // Description
    let description = "";
    doc.select(".content.expand-wrapper p").forEach(p => {
      description += p.text.trim() + " ";
    });
    description = description.trim();

    // Genres
    const genre = [];
    doc.select(".categories a.property-item").forEach(a => genre.push(a.text.trim()));

    // Status
    let status = 5;
    const st = doc.selectFirst("strong.ongoing, strong.completed");
    if (st) {
      const s = st.text.trim();
      status = s === "Ongoing" ? 0 : s === "Completed" ? 1 : 5;
    }

    // Chapters
    let chapters = [];
    const chaptersPageLink = doc.selectFirst("a.chapter-latest-container")?.getHref;
    if (chaptersPageLink) {
      const chapDoc = await this.request(chaptersPageLink.replace(this.source.baseUrl, ""));
      chapDoc.select(".chapter-list a").forEach(item => {
        chapters.push({
          name: item.attr("title") || item.text.trim(),
          url: item.getHref,
          dateUpload: ""
        });
      });
    }

    return { name, imageUrl, description, link: url, status, genre, chapters };
  }

  // -----------------------
  // CHAPTER CONTENT
  // -----------------------
  async getHtmlContent(name, url) {
    const doc = await this.request(url.replace(this.source.baseUrl, ""));
    return this.cleanHtmlContent(doc);
  }

  async cleanHtmlContent(doc) {
    const div = doc.selectFirst("#content");
    const title = div.selectFirst("h4")?.text.trim() || "No Title";

    let content = "";
    div.select("p").forEach(p => {
      const text = p.text.trim();
      if (
        text &&
        !text.includes("novelfire.net") &&
        !text.includes("disable-blocker") &&
        !p.select("img").length
      ) {
        content += text + " <br><br>";
      }
    });

    return `<h2>${title}</h2><hr><br>${content}`;
  }

  // -----------------------
  // FILTERS (none)
  // -----------------------
  getFilterList() {
    return [];
  }

  getSourcePreferences() {
    return [];
  }

  async getPopular(page) {
    return this.searchPage({ query: "" }); // Default empty popular
  }

  async getLatestUpdates(page) {
    return this.searchPage({ query: "" }); // Default empty latest
  }
}
