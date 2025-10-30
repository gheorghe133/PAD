const xml2js = require("xml2js");

class ResponseFormatter {
  constructor() {
    this.xmlBuilder = new xml2js.Builder({
      rootName: "response",
      headless: true,
      renderOpts: { pretty: true, indent: "  " },
    });
  }

  format(data, acceptHeader = "application/json") {
    const preferredType = this.getPreferredContentType(acceptHeader);

    switch (preferredType) {
      case "application/xml":
      case "text/xml":
        return {
          contentType: "application/xml",
          data: this.toXML(data),
        };
      case "application/json":
      default:
        return {
          contentType: "application/json",
          data: JSON.stringify(data, null, 2),
        };
    }
  }

  toXML(data) {
    try {
      return this.xmlBuilder.buildObject(data);
    } catch (error) {
      throw new Error(`XML conversion failed: ${error.message}`);
    }
  }

  toJSON(data) {
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      throw new Error(`JSON conversion failed: ${error.message}`);
    }
  }

  getPreferredContentType(acceptHeader) {
    if (!acceptHeader) {
      return "application/json";
    }

    const types = acceptHeader
      .split(",")
      .map((type) => {
        const [mediaType, ...params] = type.trim().split(";");
        const quality =
          params
            .find((param) => param.trim().startsWith("q="))
            ?.split("=")[1] || "1";

        return {
          type: mediaType.trim(),
          quality: parseFloat(quality),
        };
      })
      .sort((a, b) => b.quality - a.quality);

    if (types[0]?.type === "application/xml" || types[0]?.type === "text/xml") {
      return "application/xml";
    }

    return "application/json";
  }

  success(data, message = "Success") {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  error(message, code = 500, details = {}) {
    return {
      success: false,
      error: {
        message,
        code,
        ...details,
      },
      timestamp: new Date().toISOString(),
    };
  }

  paginated(data, total, offset, limit) {
    return {
      success: true,
      data,
      pagination: {
        total,
        offset,
        limit,
        hasNext: offset + limit < total,
        hasPrev: offset > 0,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new ResponseFormatter();
