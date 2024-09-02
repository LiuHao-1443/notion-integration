const { Client } = require("@notionhq/client");
require("dotenv").config();

exports.getNotionPageContent = async (req, res) => {
  try {
    const { rootPageId, notionApiKey } = req.body;

    if (!rootPageId || !notionApiKey) {
      return res.status(400).json({ message: "缺少必要的参数" });
    }

    const notion = new Client({ auth: notionApiKey });

    // 获取当前日期信息
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const weekTitle = `${getWeekRange(currentDate)} 第${getWeekNumber(
      currentDate
    )}周`;
    const pageTitle = `${formatDate(currentDate)} ${getDayOfWeek(currentDate)}`;

    // 查找年份页面
    const yearPageId = await findYearPage(rootPageId, currentYear, notion);
    if (!yearPageId) {
      throw new Error("未找到对应的年份页面");
    }

    // 查找周页面
    const weekPageId = await findWeekPage(yearPageId, weekTitle, notion);
    if (!weekPageId) {
      throw new Error("未找到对应的周页面");
    }

    // 查找日期页面
    const dayPageId = await findDayPage(weekPageId, pageTitle, notion);
    if (!dayPageId) {
      throw new Error("未找到对应的日期页面");
    }

    // 获取页面内容
    const blocks = await notion.blocks.children.list({
      block_id: dayPageId,
    });

    // 提取"今日事项"内容
    let todayTasks = [];
    let isTodayTasks = false;
    for (const block of blocks.results) {
      if (
        block.type === "quote" &&
        block.quote.rich_text[0]?.plain_text === "今日事项"
      ) {
        isTodayTasks = true;
        continue;
      }
      if (block.type === "divider") {
        break;
      }
      if (isTodayTasks && block.type === "to_do") {
        todayTasks.push({
          content: block.to_do.rich_text[0]?.plain_text || "",
          checked: block.to_do.checked,
        });
      }
    }

    res.json({ todayTasks });
  } catch (error) {
    console.error("获取 Notion 页面内容时出错:", error);
    res.status(500).json({ message: "获取 Notion 页面内容时发生错误" });
  }
};

// 辅助函数：查找年份页面
async function findYearPage(parentId, year, notion) {
  const response = await notion.search({
    query: `${year}年`,
    filter: { property: "object", value: "page" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
  });
  return response.results[0]?.id;
}

// 辅助函数：查找周页面
async function findWeekPage(parentId, weekTitle, notion) {
  const response = await notion.search({
    query: weekTitle,
    filter: { property: "object", value: "page" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
  });
  return response.results[0]?.id;
}

// 辅助函数：查找日期页面
async function findDayPage(parentId, pageTitle, notion) {
  const response = await notion.search({
    query: pageTitle,
    filter: { property: "object", value: "page" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
  });
  return response.results[0]?.id;
}

// 辅助函数：获取周范围
function getWeekRange(date) {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(
    date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1)
  );
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const startMonth = (startOfWeek.getMonth() + 1).toString().padStart(2, "0");
  const startDay = startOfWeek.getDate().toString().padStart(2, "0");
  const endMonth = (endOfWeek.getMonth() + 1).toString().padStart(2, "0");
  const endDay = endOfWeek.getDate().toString().padStart(2, "0");

  return `${startMonth}${startDay}-${endMonth}${endDay}`;
}

// 辅助函数：获取周数（ISO 8601 标准）
function getWeekNumber(date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // 将星期天视为"7"
  target.setDate(target.getDate() - dayNr + 3); // 设置为本周的周四
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000); // 604800000 = 7 * 24 * 60 * 60 * 1000
}

// 新增辅助函数：格式化日期
function formatDate(date) {
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${month}${day}`;
}

// 新增辅助函数：获取星期几
function getDayOfWeek(date) {
  const days = [
    "星期日",
    "星期一",
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六",
  ];
  return days[date.getDay()];
}

exports.saveToNotion = async (req, res) => {
  try {
    const { rootPageId, notionApiKey } = req.body;

    if (!rootPageId || !notionApiKey) {
      return res.status(400).json({ message: "缺少必要的参数" });
    }

    const notion = new Client({ auth: notionApiKey });

    // 获取当前日期和明天的日期
    const currentDate = new Date();
    const tomorrowDate = new Date(currentDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);

    // 获取明天的日期相关信息
    const tomorrowYear = tomorrowDate.getFullYear();
    const tomorrowWeek = getWeekRange(tomorrowDate);
    const weekTitle = `${tomorrowWeek} 第${getWeekNumber(tomorrowDate)}周`;
    const formattedDate = formatDate(tomorrowDate);
    const dayOfWeek = getDayOfWeek(tomorrowDate);
    const pageTitle = `${formattedDate} ${dayOfWeek}`;

    // 查找或创建年份页面和周页面
    const yearPageId = await findOrCreateYearPage(
      rootPageId,
      tomorrowYear,
      notion
    );
    const weekPageId = await findOrCreateWeekPage(
      yearPageId,
      weekTitle,
      notion
    );

    // 获取今天的未完成待办事项
    const unfinishedTasks = await getUnfinishedTasks(
      rootPageId,
      currentDate,
      notion
    );

    // 创建新页面内容
    const pageContent = [
      {
        object: "block",
        type: "quote",
        quote: {
          rich_text: [{ type: "text", text: { content: "今日事项" } }],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [],
        },
      },
      {
        object: "block",
        type: "divider",
        divider: {},
      },
      {
        object: "block",
        type: "quote",
        quote: {
          rich_text: [{ type: "text", text: { content: "待办事项" } }],
        },
      },
      ...unfinishedTasks,
    ];

    // 检查是否已存在明天的页面
    const existingPageId = await findExistingDayPage(
      weekPageId,
      pageTitle,
      notion
    );

    if (existingPageId) {
      // 如果页面已存在，更新现有页面
      await updateExistingPage(existingPageId, unfinishedTasks, notion);
      res.json({ message: "在 Notion 中已更新明天的页面" });
    } else {
      // 如果页面不存在，创建新页面
      const newPage = await notion.pages.create({
        parent: { page_id: weekPageId },
        properties: {
          title: {
            title: [{ text: { content: pageTitle } }],
          },
        },
        children: pageContent,
      });
      res.json({
        message: "新页面已成功创建在 Notion，并包含今天未完成的待办事项",
      });
    }
  } catch (error) {
    console.error("在 Notion 创建或更新页面时出错:", error);
    res.status(500).json({ message: "在 Notion 创建或更新页面时发生错误" });
  }
};

// 辅助函数：查找或创建年份页面
async function findOrCreateYearPage(parentId, year, notion) {
  // 获取父页面的子页面列表
  const childPages = await notion.blocks.children.list({
    block_id: parentId,
    page_size: 100, // 可以根据需要调整
  });

  // 在子页面中查找匹配年份的页面
  const yearPage = childPages.results.find(
    (page) =>
      page.type === "child_page" &&
      page.child_page.title === year.toString() + "年"
  );

  if (yearPage) {
    return yearPage.id;
  }

  // 如果没有找到匹配的年份页面，创建新的年页面
  const newYearPage = await notion.pages.create({
    parent: { page_id: parentId },
    properties: {
      title: {
        title: [{ text: { content: year.toString() + "年" } }],
      },
    },
  });

  return newYearPage.id;
}

// 辅助函数：查找或创建周页面
async function findOrCreateWeekPage(parentId, weekTitle, notion) {
  // 获取父页面的子页面列表
  const childPages = await notion.blocks.children.list({
    block_id: parentId,
    page_size: 100, // 可以根据需要调整
  });

  // 在子页面中查找匹配周标题的页面
  const weekPage = childPages.results.find(
    (page) => page.type === "child_page" && page.child_page.title === weekTitle
  );

  if (weekPage) {
    return weekPage.id;
  }

  // 如果没有找到匹配的周页面，创建新的周页面
  const newWeekPage = await notion.pages.create({
    parent: { page_id: parentId },
    properties: {
      title: {
        title: [{ text: { content: weekTitle } }],
      },
    },
  });

  return newWeekPage.id;
}

// 新增函数：获取今天的未完成待办事项
async function getUnfinishedTasks(rootPageId, date, notion) {
  const formattedDate = formatDate(date);
  const dayOfWeek = getDayOfWeek(date);
  const pageTitle = `${formattedDate} ${dayOfWeek}`;

  // 查找今天的页面
  const response = await notion.search({
    query: pageTitle,
    filter: {
      property: "object",
      value: "page",
    },
  });

  if (response.results.length === 0) {
    return []; // 如果找不到今天的页面，返回空数组
  }

  const todayPageId = response.results[0].id;

  // 获取页面内容
  const blocks = await notion.blocks.children.list({
    block_id: todayPageId,
  });

  // 过滤出未完成的待办事项
  const unfinishedTasks = blocks.results
    .filter((block) => block.type === "to_do" && !block.to_do.checked)
    .map((block) => ({
      object: "block",
      type: "to_do",
      to_do: {
        rich_text: block.to_do.rich_text,
        checked: false,
      },
    }));

  return unfinishedTasks;
}

// 新增辅助函数：查找现有的日期页面
async function findExistingDayPage(weekPageId, pageTitle, notion) {
  const response = await notion.search({
    query: pageTitle,
    filter: {
      property: "object",
      value: "page",
    },
    sort: {
      direction: "descending",
      timestamp: "last_edited_time",
    },
  });

  const existingPage = response.results.find(
    (page) =>
      page.parent.type === "page_id" &&
      page.parent.page_id === weekPageId &&
      page.properties.title.title[0].plain_text === pageTitle
  );

  return existingPage ? existingPage.id : null;
}

// 更新辅助函数：更新现有页面
async function updateExistingPage(pageId, unfinishedTasks, notion) {
  // 获取现有页面内容
  const existingBlocks = await notion.blocks.children.list({
    block_id: pageId,
  });

  // 删除所有现有内容
  for (const block of existingBlocks.results) {
    await notion.blocks.delete({ block_id: block.id });
  }

  // 创建新的页面内容
  const newPageContent = [
    {
      object: "block",
      type: "quote",
      quote: {
        rich_text: [{ type: "text", text: { content: "今日事项" } }],
      },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [],
      },
    },
    {
      object: "block",
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      type: "quote",
      quote: {
        rich_text: [{ type: "text", text: { content: "待办事项" } }],
      },
    },
    ...unfinishedTasks,
  ];

  // 添加新的内容
  await notion.blocks.children.append({
    block_id: pageId,
    children: newPageContent,
  });
}
