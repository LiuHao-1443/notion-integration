var express = require("express");
var router = express.Router();
const notionController = require("../controllers/notionController");

// 获取 Notion 页面内容
router.post("/getNotionContent", notionController.getNotionPageContent);

// 新增路由:向 Notion 页面写入数据
router.post("/saveToNotion", notionController.saveToNotion);

module.exports = router;
