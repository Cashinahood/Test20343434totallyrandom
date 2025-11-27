const novelfireSources = [
  {
    "name": "Novelfire",
    "id": 25067417293,
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
  },
];

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
      "Accept": "application/json,text/html,*/*",
      "Referer": this.source.baseUrl + "/",
    };
  }

  async request(url, options = {}) {
    const res = await this.client.get(url, { headers: this.getHeaders(url), ...options });
    return res.body;
  }

  // ------------------------------
  // SEARCH (AJAX)
  // ------------------------------
  async searchPage({ query = "", page = 1 } = {}) {
    let url = `${this.source.baseUrl}/ajax/searchLive?inputContent=${encodeURIComponent(query)}`;
    const res = await this.request(url);
    const json = JSON.parse(res);
    const doc = new Document(json.html);

    const list = [];
    doc.select("li.novel-item").forEach(item => {
      const a = item.selectFirst("a");
      if (!a) return;

      const link = a.getHref;
      const nameEl = a.selectFirst("h4.novel-title");
      let name = nameEl ? nameEl.text.trim() : "";
      const stats = a.select(".novel-stats");
      const chaptersText = stats.length > 1 ? stats[1].text.trim() : "";
      const chapterCountMatch = chaptersText.match(/\d+/);
      const chapterCount = chapterCountMatch ? parseInt(chapterCountMatch[0]) : 0;

      const rankText = stats.length > 0 ? stats[0].text.trim() : "";
      name = `${name} | ${rankText} | ${chapterCount} Chapters`;

      const imageUrl = a.selectFirst("img").attr("src");

      list.push({ name, link, imageUrl });
    });

    return { list, hasNextPage: false }; // AJAX search does not support pagination
  }

  async search(query, page, filters) {
    return this.searchPage({ query, page });
  }

  async getPopular(page) {
    return { list: [], hasNextPage: false }; // Not supported for now
  }

  async getLatestUpdates(page) {
    return { list: [], hasNextPage: false }; // Not supported for now
  }

  // ------------------------------
  // DETAIL
  // ------------------------------
  async getDetail(url) {
    const slug = url.replace(this.source.baseUrl, "");
    const html = await this.request(this.source.baseUrl + slug);
    const doc = new Document(html);

    const name = doc.selectFirst("h1.novel-title")?.text.trim() || "";
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

    // Chapters (from dedicated page)
    const chapters = [];
    const chaptersPageLink = doc.selectFirst("a.chapter-latest-container")?.getHref;
    if (chaptersPageLink) {
      const chapHtml = await this.request(chaptersPageLink);
      const chapDoc = new Document(chapHtml);
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

  // ------------------------------
  // CHAPTER CONTENT
  // ------------------------------
  async getHtmlContent(name, url) {
    const html = await this.request(url);
    const doc = new Document(html);
    return this.cleanHtmlContent(doc);
  }

  async cleanHtmlContent(doc) {
    const div = doc.selectFirst("#content");
    if (!div) return "";

    const title = div.selectFirst("h4")?.text.trim() || "";
    let content = "";
    div.select("p").forEach(p => {
      const text = p.text.trim();
      if (text && !text.includes("novelfire.net") && !text.includes("disable-blocker") && !p.select("img").length) {
        content += text + " <br><br>";
      }
    });

    return `<h2>${title}</h2><hr><br>${content}`;
  }

  // ------------------------------
  // FILTERS
  // ------------------------------
  getFilterList() {
    return []; // No filters needed
  }

  getSourcePreferences() {
    return [];
  }
}
