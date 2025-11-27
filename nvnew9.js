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
      "Referer": this.source.baseUrl + "/",
    };
  }

  async request(slug) {
    const url = `${this.source.baseUrl}${slug}`;
    const res = await this.client.get(url, { headers: this.getHeaders(url) });
    return new Document(res.body);
  }

  // ---------------------------------------
  // DETAIL PAGE (with parallel scraping for all chapters)
  // ---------------------------------------
  async getDetail(url) {
    const slug = url.replace(this.source.baseUrl, "");
    const doc = await this.request(slug);

    const name = doc.selectFirst("h1.novel-title").text.trim();
    const imageUrl = doc.selectFirst(".novel-cover img").attr("data-src");

    // Description
    let description = "";
    doc.select(".content.expand-wrapper p").forEach(p => {
      description += p.text.trim() + " ";
    });
    description = description.trim();

    // Status
    const statusText = doc.selectFirst(".novel-status")?.text.trim() ?? "Ongoing";
    let status = 0;  // Default to ongoing
    if (statusText.toLowerCase().includes("completed")) status = 1;

    // Fetch all chapters
    const chapters = await this.scrapeChaptersParallel(url);

    return {
      name,
      imageUrl,
      description,
      link: url,
      status,
      genre: [], // You can add genre parsing if needed
      chapters,
    };
  }

  // ---------------------------------------
  // PARALLEL CHAPTER SCRAPING
  // ---------------------------------------
  async scrapeChaptersParallel(url) {
    const allChapters = [];
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const pageUrl = `${url}?page=${currentPage}`;
      console.log(`Scraping page ${currentPage}: ${pageUrl}`);

      try {
        const res = await this.client.get(pageUrl, { headers: this.getHeaders(pageUrl) });
        const doc = new Document(res.body);

        const chapters = doc.select("ul.chapter-list li").map(li => {
          const a = li.selectFirst("a");
          if (!a) return null;

          const url = a.getHref;
          const name = a.selectFirst("strong.chapter-title")?.text.trim() || "";
          const chapterNum = a.selectFirst("span.chapter-no")?.text.trim() || "Unknown";
          const dateStr = a.selectFirst("time.chapter-update")?.attr("datetime") || "";
          const dateUpload = dateStr ? new Date(dateStr).valueOf().toString() : "0";

          return {
            name,
            url,
            chapter: chapterNum,
            dateUpload,
          };
        }).filter(Boolean);

        allChapters.push(...chapters);

        // Check for the next page
        const nextPageButton = doc.selectFirst(".pagination .page-item a[rel='next']");
        hasNextPage = nextPageButton !== null;

        currentPage++;
      } catch (err) {
        console.error(`Error fetching page ${currentPage}:`, err);
        break;
      }
    }

    // Sort chapters numerically by chapter number
    allChapters.sort((a, b) => parseInt(a.chapter, 10) - parseInt(b.chapter, 10));

    return allChapters;
  }

  // ---------------------------------------
  // FILTERS (for browsing only)
  // ---------------------------------------
  getFilterList() {
    // Your filter code here if needed
    return [];
  }

  getSourcePreferences() {
    return [];
  }
}
