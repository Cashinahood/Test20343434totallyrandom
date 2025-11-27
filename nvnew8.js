const mangayomiSources = [
  {
    "name": "Novelfire",
    "id": 25067417293,
    "baseUrl": "https://novelfire.net",
    "lang": "en",
    "typeSource": "single",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://novelfire.net/",
    "dateFormat": "",
    "dateFormatLocale": "",
    "isNsfw": false,
    "hasCloudflare": false,
    "sourceCodeUrl": "",
    "apiUrl": "",
    "version": "0.0.1",
    "isManga": false,
    "itemType": 2,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
    "pkgPath": "novel/src/en/novelfire.js",
  },
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  async request(url) {
    const body = (await this.client.get(url)).body;
    return new Document(body);
  }

  async getDetail(url) {
    const baseUrl = this.source.baseUrl;
    const slug = url.replace(baseUrl, "");
    const doc = await this.request(slug);

    const novelItem = doc.selectFirst(".novel-item");
    const name = novelItem.selectFirst("h1 a").text.trim();
    const imageUrl = novelItem.selectFirst(".novel-cover img").attr("src");
    const statusText = novelItem.selectFirst(".status").text.trim();
    const status = statusText.toLowerCase() === "ongoing" ? 0 : 1;

    const description = doc.selectFirst("header p").text.trim();

    // Genres (Novelfire may not list genres on chapters page, optional)
    let genre = [];
    // genre = doc.select(".genre-list a").map(a => a.text.trim());

    // Collect chapters from all pages
    let chapters = [];
    let page = 1;
    let lastPage = false;

    while (!lastPage) {
      const pageUrl = `${slug}/chapters?page=${page}`;
      const pageDoc = await this.request(pageUrl);

      const chapterEls = pageDoc.select(".chapter-list li a");
      chapterEls.forEach((el) => {
        chapters.push({
          name: el.text.trim(),
          url: el.getHref,
          dateUpload: "", // Novelfire doesn’t seem to provide exact date here
        });
      });

      // Check if there’s a next page
      const nextPage = pageDoc.selectFirst(".pagination li a[rel=next]");
      lastPage = !nextPage;
      page++;
    }

    return {
      name,
      imageUrl,
      description,
      link: url,
      status,
      genre,
      chapters,
    };
  }

  async getHtmlContent(name, url) {
    const doc = await this.request(url);
    return this.cleanHtmlContent(doc);
  }

  async cleanHtmlContent(html) {
    const para = html.selectFirst(".content-inner").select("p");
    const title = para[0].text.trim();
    let content = "";
    para.slice(1).forEach((item) => {
      content += item.text.trim() + " <br>";
    });
    return `<h2>${title}</h2><hr><br>${content}`;
  }
}
