const mangayomiSources = [
  {
    "name": "Novelfire",
    "id": 25067417293,  // updated ID
    "baseUrl": "https://novelfire.net",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://novelfire.net/",
    "dateFormat": "MMM dd, yyyy",
    "dateFormatLocale": "en",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.1.0",
    "isManga": false,
    "itemType": 2,
    "isFullData": true,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "novel/src/en/novelfire.js",
  },
];

class NovelfireExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  async request(slug) {
    const url = `${this.source.baseUrl}${slug}`;
    const body = (await this.client.get(url)).body;
    return new Document(body);
  }

  async searchPage({ query = "", status = "all", sort = "views", page = 1 } = {}) {
    let slug = `/search?q=${query}&status=${status}&sort=${sort}&page=${page}`;
    const doc = await this.request(slug);
    const list = [];

    doc.select(".novel-item").forEach(item => {
      const linkSection = item.selectFirst("a");
      const link = linkSection.getHref;
      const name = linkSection.attr("title") || linkSection.text.trim();
      const imageUrl = "https:" + linkSection.selectFirst("img").attr("data-src");
      list.push({ name, link, imageUrl });
    });

    const paginator = doc.selectFirst(".pagination");
    const hasNextPage = paginator ? !!paginator.select("a[rel=next]").length : false;

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return this.searchPage({ sort: "views", page });
  }

  async getLatestUpdates(page) {
    return this.searchPage({ sort: "updated_at", page });
  }

  async search(query, page, filters) {
    const status = filters?.[0]?.values[filters[0].state]?.value || "all";
    const sort = filters?.[1]?.values[filters[1].state]?.value || "views";
    return this.searchPage({ query, status, sort, page });
  }

  async getDetail(url) {
    const slug = url.replace(this.source.baseUrl, "");
    const doc = await this.request(slug);

    const name = doc.selectFirst(".novel-item h1 a").text.trim();
    const imageUrl = "https:" + doc.selectFirst(".novel-item .novel-cover img").attr("src");
    const statusText = doc.selectFirst(".item-body .status").text.trim();
    const status = { "Ongoing": 0, "Completed": 1 }[statusText] ?? 5;
    const description = doc.selectFirst("header p").text.trim();

    const chapters = [];
    doc.select(".chapter-list li a").forEach(chap => {
      chapters.push({
        name: chap.text.trim(),
        url: chap.getHref,
        dateUpload: new Date().valueOf().toString() // date not always available
      });
    });

    return { name, imageUrl, description, link: url, status, genre: [], chapters };
  }

  async getHtmlContent(name, url) {
    const doc = await this.request(url);
    return this.cleanHtmlContent(doc);
  }

  async cleanHtmlContent(html) {
    const para = html.selectFirst(".content-inner").select("p");
    const title = para[0].text.trim();
    let content = "";
    para.slice(1).forEach(p => content += p.text.trim() + " <br>");
    return `<h2>${title}</h2><hr><br>${content}`;
  }

  getFilterList() {
    return [
      {
        type_name: "SelectFilter",
        name: "Status",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "All", value: "all" },
          { type_name: "SelectOption", name: "Ongoing", value: "ongoing" },
          { type_name: "SelectOption", name: "Completed", value: "completed" },
        ]
      },
      {
        type_name: "SelectFilter",
        name: "Order by",
        state: 0,
        values: [
          { type_name: "SelectOption", name: "Views", value: "views" },
          { type_name: "SelectOption", name: "Updated", value: "updated_at" },
          { type_name: "SelectOption", name: "Created", value: "created_at" },
        ]
      }
    ];
  }

  getSourcePreferences() {
    throw new Error("getSourcePreferences not implemented");
  }
}
