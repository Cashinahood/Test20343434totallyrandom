{
    "name": "Novelfire",
    "id": 2507947283,
    "baseUrl": "https://novelfire.net",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://novelfire.net/logo.ico",
    "version": "0.0.2",
    "isManga": false,
    "itemType": 2,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "sourceCodeLanguage": 1,
    "pkgPath": "novel/src/en/novelfire.js"
}

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
    let url = `${this.source.baseUrl}${slug}`;
    let res = await this.client.get(url, { headers: this.getHeaders(url) });
    return new Document(res.body);
  }

  // ---------------------------------------
  // SEARCH (DIRECT)
  // ---------------------------------------
  async searchPage({
    query = "",
    genres = [],
    status = "all",
    sort = "new",
    page = 1
  } = {}) {

    let slug = "";

    if (query) {
      // REAL keyword search
      slug = `/search?keyword=${encodeURIComponent(query)}&page=${page}`;
    } else {
      // Browsing mode (filters apply)
      slug = `/genre-all/sort-${sort}/status-${status}/all-novel?page=${page}`;
      if (genres.length > 0) {
        slug += `&genre=${genres.join(",")}`;
      }
    }

    const doc = await this.request(slug);

    const list = [];

    doc.select("#list-novel .novel-item").forEach(item => {
      const a = item.selectFirst("a");
      if (!a) return;

      const link = a.getHref;
      const name = a.attr("title") || a.text.trim();
      const imageUrl = a.selectFirst("img").attr("data-src");

      list.push({ name, link, imageUrl });
    });

    const hasNextPage = doc.selectFirst("a[rel='next']") !== null;

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return this.searchPage({ sort: "popular", page });
  }

  async getLatestUpdates(page) {
    return this.searchPage({ sort: "new", page });
  }

  async search(query, page, filters) {
    // Filters only apply when query is empty
    if (query) {
      return this.searchPage({ query, page });
    }

    function getBox(state) {
      return state.filter(i => i.state).map(i => i.value);
    }
    function getSelect(filter) {
      return filter.values[filter.state].value;
    }

    const genres = filters ? getBox(filters[0].state) : [];
    const status = filters ? getSelect(filters[1]) : "all";
    const sort = filters ? getSelect(filters[2]) : "new";

    return this.searchPage({ query, genres, status, sort, page });
  }

  // ---------------------------------------
  // DETAIL PAGE
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

    // Genres
    const genre = [];
    doc.select(".categories a.property-item").forEach(a =>
      genre.push(a.text.trim())
    );

    // Status
    let status = 5;
    const st = doc.selectFirst("strong.ongoing, strong.completed");
    if (st) {
      const s = st.text.trim();
      status = s === "Ongoing" ? 0 : s === "Completed" ? 1 : 5;
    }

    // Chapters (Novelfire lists chapters on dedicated page)
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

  // ---------------------------------------
  // CHAPTER CONTENT
  // ---------------------------------------
  async getHtmlContent(name, url) {
    const doc = await this.request(url.replace(this.source.baseUrl, ""));
    return this.cleanHtmlContent(doc);
  }

  async cleanHtmlContent(doc) {
    const div = doc.selectFirst("#content");

    const title = div.selectFirst("h4").text.trim();

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

  // ---------------------------------------
  // FILTERS (for browsing only)
  // ---------------------------------------
  getFilterList() {
    function makeState(type, names, vals) {
      return names.map((n, i) => ({ type_name: type, name: n, value: vals[i] }));
    }

    const genres = [
      "Action", "Adventure", "Adult", "Anime", "Arts",
      "Comedy", "Drama", "Eastern", "Ecchi", "Fan-fiction",
      "Fantasy", "Gender Bender", "Harem", "Historical", "Horror",
      "Isekai", "Josei", "Light+", "Magic", "Magical realism",
      "Martial Arts", "Mature", "Mecha", "Military", "Modern Life",
      "Movies", "Mystery", "Other", "Psychological", "Realistic fiction",
      "Reincarnation", "Romance", "School Life", "Sci-fi", "Seinen",
      "Shoujo", "Shoujo ai", "Shoumen Ai", "Shounen", "Slice of Life",
      "Smut", "Sports", "Supernatural", "System", "Tragedy",
      "Urban", "Urban life", "Video games", "War", "Wuxia",
      "Xianxia", "Xuanhuan", "Yaoi", "Yuri"
    ];

    const genreVals = genres.map(g =>
      g.toLowerCase()
        .replace(/\+/g, "plus")
        .replace(/\s+/g, "-")
        .replace(/[^\w-]/g, "")
    );

    return [
      {
        type_name: "GroupFilter",
        name: "Genres",
        state: makeState("CheckBox", genres, genreVals)
      },
      {
        type_name: "SelectFilter",
        name: "Status",
        state: 0,
        values: makeState("SelectOption", ["All", "Ongoing", "Completed"], ["all", "ongoing", "completed"])
      },
      {
        type_name: "SelectFilter",
        name: "Order by",
        state: 0,
        values: makeState("SelectOption", ["New", "Popular", "Rating", "Name", "Views"], ["new", "popular", "rating", "name", "views"])
      }
    ];
  }

  getSourcePreferences() {
    return [];
  }
}
