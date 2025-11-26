{
    "name": "Novelfire",
    "id": 2507947283,
    "baseUrl": "https://novelfire.net",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://novelfire.net/logo.ico",
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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate",
      "Referer": this.source.baseUrl + "/"
    };
  }

  async request(slug) {
    var url = `${this.source.baseUrl}${slug}`;
    var body = (await this.client.get(url, { headers: this.getHeaders(url) })).body;
    return new Document(body);
  }

  async searchPage({
    query = "",
    genres = [],
    status = "all",
    sort = "new",
    page = 1,
  } = {}) {
    function addSlug(para, value) {
      return `&${para}=${value}`;
    }
    function bundleSlug(category, items) {
      var rd = "";
      for (var item of items) {
        rd += `&${category}[]=${item.toLowerCase()}`;
      }
      return rd;
    }

    // Novelfire uses different URL structure for browsing
    var slug = "/genre-all/sort-new/status-all/all-novel?";
    slug += `page=${page}`;
    
    if (query) {
      slug += `&keyword=${query}`;
    }
    if (genres.length > 0) {
      slug += `&genre=${genres.join(',')}`;
    }
    if (status !== "all") {
      slug = slug.replace("status-all", `status-${status}`);
    }
    if (sort !== "new") {
      slug = slug.replace("sort-new", `sort-${sort}`);
    }

    var doc = await this.request(slug);

    var list = [];
    var hasNextPage = false;
    
    // Novelfire novel items structure
    doc.select("#list-novel .novel-item").forEach((item) => {
      var linkSection = item.selectFirst("a");
      var link = linkSection.getHref;
      var name = linkSection.attr("title");

      var imageUrl = linkSection.selectFirst("img").attr("data-src");
      list.push({ name, link, imageUrl });
    });

    // Novelfire pagination
    var nextPage = doc.selectFirst("a[rel='next']");
    hasNextPage = nextPage !== null;

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return await this.searchPage({ sort: "popular", page: page });
  }

  async getLatestUpdates(page) {
    return await this.searchPage({ sort: "new", page: page });
  }

  async search(query, page, filters) {
    function checkBox(state) {
      var rd = [];
      state.forEach((item) => {
        if (item.state) {
          rd.push(item.value);
        }
      });
      return rd;
    }
    function selectFiler(filter) {
      return filter.values[filter.state].value;
    }

    var isFiltersAvailable = filters && filters.length !== 0;
    var genres = isFiltersAvailable ? checkBox(filters[0].state) : [];
    var status = isFiltersAvailable ? selectFiler(filters[1]) : "all";
    var sort = isFiltersAvailable ? selectFiler(filters[2]) : "new";

    return await this.searchPage({ query, genres, status, sort, page });
  }

  async getDetail(url) {
    function statusCode(status) {
      return (
        {
          "Ongoing": 0,
          "Completed": 1,
        }[status] ?? 5
      );
    }
    
    var baseUrl = this.source.baseUrl;
    var slug = url.replace(baseUrl, "");

    var doc = await this.request(slug);

    // Novelfire detail page structure
    var name = doc.selectFirst("h1.novel-title").text;
    var imageUrl = doc.selectFirst(".novel-cover img").attr("data-src");
    
    // Description
    var description = "";
    var descElements = doc.selectFirst(".content.expand-wrapper").select("p");
    descElements.forEach((p) => {
      description += p.text.trim() + " ";
    });
    description = description.trim();

    // Genres
    var genre = [];
    doc.select(".categories a.property-item").forEach((a) => {
      genre.push(a.text.trim());
    });

    // Status
    var status = 5;
    var statusElement = doc.selectFirst("strong.ongoing, strong.completed");
    if (statusElement) {
      status = statusCode(statusElement.text.trim());
    }

    // Chapters
    var chapters = [];
    var chaptersLink = doc.selectFirst("a.chapter-latest-container").getHref;
    var chapDoc = await this.request(chaptersLink.replace(baseUrl, ""));
    
    chapDoc.select(".chapter-list a").forEach((item) => {
      var chapLink = item.getHref;
      var chapName = item.attr("title");
      chapters.push({
        name: chapName,
        url: chapLink,
        dateUpload: "", // Novelfire doesn't show dates in chapter list
      });
    });

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
    var doc = await this.request(url.replace(this.source.baseUrl, ""));
    return this.cleanHtmlContent(doc);
  }

  async cleanHtmlContent(html) {
    var contentDiv = html.selectFirst("#content");
    var title = contentDiv.selectFirst("h4").text.trim();
    var content = "";
    
    contentDiv.select("p").forEach((item) => {
      var text = item.text.trim();
      // Filter out ads and source notes
      if (text && 
          !text.includes("novelfire.net") && 
          !text.includes("disable-blocker") &&
          !item.select("img").length) {
        content += text + " <br><br>";
      }
    });
    
    return `<h2>${title}</h2><hr><br>${content}`;
  }

  getFilterList() {
    function formateState(type_name, items, values) {
      var state = [];
      for (var i = 0; i < items.length; i++) {
        state.push({ type_name: type_name, name: items[i], value: values[i] });
      }
      return state;
    }

    var filters = [];
    var items = [];
    var values = [];

    // Genres - Based on Novelfire categories
    items = [
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

    values = items.map(item => 
      item.toLowerCase()
          .replace(/\+/g, 'plus')
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '')
    );

    filters.push({
      type_name: "GroupFilter",
      name: "Genres",
      state: formateState("CheckBox", items, values),
    });

    // Status
    items = ["All", "Ongoing", "Completed"];
    values = ["all", "ongoing", "completed"];
    filters.push({
      type_name: "SelectFilter",
      name: "Status",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Sort order - Novelfire specific
    items = ["New", "Popular", "Rating", "Name", "Views"];
    values = ["new", "popular", "rating", "name", "views"];
    filters.push({
      type_name: "SelectFilter",
      name: "Order by",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    return filters;
  }

  getSourcePreferences() {
    return [];
  }
}