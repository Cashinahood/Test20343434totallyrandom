class NovelfireExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  getHeaders(url) {
    return {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json,text/html",
      "Referer": this.source.baseUrl + "/"
    };
  }

  async request(slug) {
    const url = slug.startsWith("http") ? slug : `${this.source.baseUrl}${slug}`;
    const res = await this.client.get(url, { headers: this.getHeaders(url) });
    return res.body;
  }

  // ---------------------------
  // SEARCH
  // ---------------------------
  async search(query) {
    if (!query) return { list: [], hasNextPage: false };

    const body = await this.request(`/ajax/searchLive?inputContent=${encodeURIComponent(query)}`);
    const json = JSON.parse(body);
    const doc = new Document(json.html);

    const list = [];
    doc.select("li.novel-item").forEach(item => {
      const a = item.selectFirst("a");
      if (!a) return;

      const name = a.selectFirst(".novel-title")?.text.trim() || "";
      const link = a.getHref;
      const imageUrl = a.selectFirst("img")?.attr("src") || "";

      // Status: try to find ongoing/completed
      let status = 5;
      const st = item.selectFirst("strong.ongoing, strong.completed");
      if (st) {
        const s = st.text.trim();
        status = s === "Ongoing" ? 0 : s === "Completed" ? 1 : 5;
      }

      list.push({ name, link, imageUrl, status });
    });

    return { list, hasNextPage: false };
  }

  // ---------------------------
  // DETAIL PAGE
  // ---------------------------
  async getDetail(url) {
    const slug = url.replace(this.source.baseUrl, "");
    const html = await this.request(slug);
    const doc = new Document(html);

    const name = doc.selectFirst("h1.novel-title")?.text.trim() || "";
    const imageUrl = doc.selectFirst(".novel-cover img")?.attr("src") || "";

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
    const chapters = [];
    const chaptersLink = doc.selectFirst("a.chapter-latest-container")?.getHref;
    if (chaptersLink) {
      const chapHtml = await this.request(chaptersLink.replace(this.source.baseUrl, ""));
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

  // ---------------------------
  // CHAPTER CONTENT
  // ---------------------------
  async getHtmlContent(name, url) {
    const html = await this.request(url.replace(this.source.baseUrl, ""));
    const doc = new Document(html);

    const div = doc.selectFirst("#content, .novel-content");
    if (!div) return "<p>Content not found.</p>";

    const title = div.selectFirst("h4")?.text.trim() || "";
    let content = "";
    div.childNodes().forEach(node => {
      if (node.tagName === "p" || node.tagName === "div" || node.tagName === "span") {
        const text = node.text.trim();
        if (text && !text.includes("novelfire.net") && !text.includes("disable-blocker")) {
          content += text + " <br><br>";
        }
      }
    });

    return `<h2>${title}</h2><hr><br>${content}`;
  }

  getFilterList() { return []; }
  getSourcePreferences() { return []; }
}
