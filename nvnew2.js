class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  getHeaders(url) {
    return {
      "User-Agent": "Mozilla/5.0",
      "Accept": "text/html",
      "Referer": this.source.baseUrl + "/",
    };
  }

  async request(slug) {
    let url = `${this.source.baseUrl}${slug}`;
    let res = await this.client.get(url, { headers: this.getHeaders(url) });
    return new Document(res.body);
  }

  async searchPage({ query = "", page = 1 } = {}) {
    const slug = `/ajax/searchLive?inputContent=${encodeURIComponent(query)}`;
    const res = await this.client.get(`${this.source.baseUrl}${slug}`, { headers: this.getHeaders(slug) });
    const json = JSON.parse(res.body);
    const doc = new Document(json.html);

    const list = [];
    doc.select("li.novel-item").forEach(item => {
      const a = item.selectFirst("a");
      const link = a.getHref;
      const name = a.attr("title") || a.text.trim();
      const imageUrl = a.selectFirst("img").attr("src");
      list.push({ name, link, imageUrl });
    });

    return { list, hasNextPage: false };
  }

  async search(query, page, filters) {
    return this.searchPage({ query, page });
  }

  async getDetail(url) {
    const slug = url.replace(this.source.baseUrl, "");
    const doc = await this.request(slug);

    const name = doc.selectFirst("h1.novel-title").text.trim();
    const imageUrl = doc.selectFirst(".novel-cover img").attr("data-src");

    let description = "";
    doc.select(".content.expand-wrapper p").forEach(p => description += p.text.trim() + " ");
    description = description.trim();

    const genre = [];
    doc.select(".categories a.property-item").forEach(a => genre.push(a.text.trim()));

    let status = 5;
    const st = doc.selectFirst("strong.ongoing, strong.completed");
    if (st) status = st.text.trim() === "Ongoing" ? 0 : 1;

    let chapters = [];
    const chaptersPageLink = doc.selectFirst("a.chapter-latest-container").getHref;
    const chapDoc = await this.request(chaptersPageLink.replace(this.source.baseUrl, ""));
    chapDoc.select(".chapter-list a").forEach(item => {
      chapters.push({
        name: item.attr("title") || item.text.trim(),
        url: item.getHref,
        dateUpload: ""
      });
    });

    return { name, imageUrl, description, link: url, status, genre, chapters };
  }

  async getHtmlContent(name, url) {
    const doc = await this.request(url.replace(this.source.baseUrl, ""));
    return this.cleanHtmlContent(doc);
  }

  async cleanHtmlContent(doc) {
    const div = doc.selectFirst("#content");
    const title = div.selectFirst("h4").text.trim();
    let content = "";
    div.select("p").forEach(p => content += p.text.trim() + "<br><br>");
    return `<h2>${title}</h2><hr><br>${content}`;
  }

  getSourcePreferences() { return []; }
}
