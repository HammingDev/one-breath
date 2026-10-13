# Privacy Policy / 隐私政策

Last updated / 更新日期：2026-10-13

One Breath（「一息」）的唯一用途是通过打开前的短暂休息、共享浏览时长和结束后的冷却，帮助用户控制对 X / Twitter 网站的访问。

## 本地处理的信息

- 插件读取标签页的地址和 ID，以识别 X / Twitter 页面、共享会话及判断最后一个相关页面何时关闭。`tabs` 权限使插件能够读取标签页地址，但代码不保存非目标网站的地址。
- 设置、会话阶段、开始时间、截止时间、冷却时长、临时访问的截止时间和参与会话的标签页 ID 存放在 `chrome.storage.local`。
- 休息练习的随机校验标识、开始时间和时长临时保存在 `chrome.storage.session`。
- 被拦截的 X / Twitter 原始 URL（可能含路径、搜索参数）保留在本地提醒页的地址片段中，用于在用户选择继续时返回原页面。该地址可能出现在浏览器历史记录或其同步中，取决于用户的 Chrome 设置；插件不控制 Chrome 自身的数据处理。

## 不上传、不售卖

插件没有开发者服务器，不向开发者或第三方发送上述信息。不含广告、遥测、分析 SDK 或远程执行的代码。不读取 Cookie、账户凭据、私信内容或页面正文。访问 X / Twitter 后，该网站自身的数据处理受其隐私政策约束。

数据只用于实现上述用户可见功能，不用于广告、用户画像、售卖、信用评估或放贷。One Breath 对用户数据的使用遵守 Chrome Web Store User Data Policy，包括 Limited Use 要求。

## 权限用途

- `storage`：保存本地偏好与会话状态。
- `alarms`：触发会话和冷却到期检查。
- `tabs`：识别相关标签页、检测关闭/离开以及将到期页面替换为提醒页。
- `declarativeNetRequest`：在浏览器请求层拦截目标网站的访问。
- `*://*.x.com/*`、`*://*.twitter.com/*`：仅在目标网站执行访问限制、到时检查和结束浏览按钮。

## 保留与删除

当前会话数据随状态转换被替换。临时练习数据在相应标签页关闭、开始会话或浏览器会话结束后移除。偏好持续保留，直到用户更改或卸载插件。卸载插件会删除插件的本地存储；浏览器历史记录需通过 Chrome 自身管理。

## 联系与政策更新

代码及支持：https://github.com/HammingDev/one-breath

如有问题，请通过仓库 Issues 联系维护者。不要在公开 Issue 中提交私密链接、Cookie 或账户凭据。若未来增加数据处理行为，会更新本政策及商店披露。

---

## English summary

One Breath limits access to X / Twitter using a short pause, a shared timed session and a cooldown. All extension processing is local. It reads tab URLs and IDs to identify target pages and stores settings and current session timestamps/IDs in local Chrome extension storage. Exercise challenges are temporary session data. The original target URL is retained in the local intervention page fragment so that users can return to it; Chrome may retain or sync browsing history according to the user's browser settings.

The extension has no developer backend, analytics, advertising, remote code, or data sale. It does not read cookies, credentials, private messages or page text. No information is transmitted to the developer or third parties by the extension. Normal browsing on X / Twitter is governed by that site's own policies. Extension data use complies with the Chrome Web Store User Data Policy, including Limited Use requirements.

Uninstalling removes extension storage; browser history is managed separately in Chrome. For support, use the repository Issues without posting sensitive information.
