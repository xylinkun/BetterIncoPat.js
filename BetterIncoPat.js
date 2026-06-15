// ==UserScript==
// @name         BetterIncopat
// @namespace    http://incopat.com/
// @version      0.9
// @description  去除incoPat检索结果页面、IPC分类查询页面两侧的空白，有效利用宽屏显示器；专利详情查看页，添加有用的复制按钮、跳过文件名选择对话框。
// @author       You
// @include      *incopat.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  'use strict';

  function AddCustomStyle() {
    // 注意 @run-at document-start 时，GM_addStyle 也可以生效
    GM_addStyle(".middle,#container{width:100% !important;}");

    // 去掉这里比较容易出错的空格
    if (window.location.href === "https://ipc.incopat.com/index") {
      GM_addStyle(".floor_con, #container{width:100% !important;}");
    }
  }

  function CreateURLfileAndDownload(url, num) {
    const content = `[InternetShortcut]\r\nURL=${url}`; // 显式使用Windows系统下默认的换行符号CRLF

    // 直接使用GM_download保存文件代替FileSaver.js
    GM_download({
      url: "data:text/plain;charset=utf-8," + encodeURIComponent(content),
      name: `${num}.url`,
      saveAs: false // 不显示保存对话框
    });
  }

  function SkipPdfNameSelectDialog() {
    if (!window.location.href.startsWith("https://www.incopat.com/detail/")) {
      return;
    }

    // 等待PDF按钮加载，并监听点击事件
    function attachPdfListener() {
      const pdfBtn = document.querySelector("#header_patentDownloadBtn");
      if (pdfBtn && !pdfBtn.dataset.listenerAttached) {
        pdfBtn.dataset.listenerAttached = "true";
        pdfBtn.addEventListener("click", function () {
          setTimeout(() => {
            // 新版前端的确定按钮是 #pdfDownload_confirm
            const confirmBtn = document.querySelector("#pdfDownload_confirm");
            if (confirmBtn) confirmBtn.click();
          }, 100);
        });
      }
    }

    // 立即执行一次
    attachPdfListener();

    // 使用 MutationObserver 监听 DOM 变化，因为PDF按钮可能是动态显示的
    const observer = new MutationObserver(() => {
      attachPdfListener();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  function AddCopyButtons() {
    if (!window.location.href.startsWith("https://www.incopat.com/detail/")) {
      return;
    }

    const pageScope = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    // 优先使用全局变量获取当前专利信息
    let currentPn = pageScope.currentPn || "";
    let currentAn = pageScope.currentAn || "";
    const currentAd = pageScope.currentAd || "";
    const currentPnc = pageScope.currentPnc || { in_array: () => false };

    // 如果全局变量不存在，从patentList中获取（需要先获取正确的索引）
    if (!currentPn || !currentAn) {
      let currentIndex = 0;

      // 当patentList只有1项时（如未登录通过URL直接打开），直接使用索引0
      if (pageScope.patentList && pageScope.patentList.length === 1) {
        currentIndex = 0;
        console.log('BetterIncoPat调试：patentList只有1项，直接使用索引0');
      } else {
        // 正常情况下，根据页面显示索引计算
        const currentIndexElement = document.querySelector("#resultList_current") || document.querySelector("#currentPnIndex");
        const solrQueryBean = pageScope.solrQueryBeanDetailNew || pageScope.solrQueryBean;
        const startRow = solrQueryBean ? parseInt(solrQueryBean.startRow || 0) : 0;

        if (currentIndexElement && currentIndexElement.textContent) {
          // 页面显示的索引从1开始，需要减去startRow和1得到patentList中的索引
          const displayIndex = parseInt(currentIndexElement.textContent.trim());
          if (!isNaN(displayIndex) && displayIndex > 0) {
            currentIndex = displayIndex - startRow - 1;
            console.log(`BetterIncoPat调试：显示索引=${displayIndex}，startRow=${startRow}，patentList索引=${currentIndex}`);
          }
        }
      }

      const patentData = pageScope.patentList && pageScope.patentList[currentIndex];
      if (!currentPn && patentData) currentPn = patentData.pn || "";
      if (!currentAn && patentData) currentAn = patentData.an || "";
    }

    // 如果patentList中没有申请号，尝试从多个DOM元素中获取
    if (!currentAn) {
      console.log('BetterIncoPat调试：patentList中未找到申请号，开始从DOM查找');

      // 方案1：从详情页的申请号链接元素获取
      let anElement = document.querySelector('a.link.advance-link[data-key="AN"]');
      console.log('BetterIncoPat调试：方案1查找结果', anElement);
      if (anElement && anElement.getAttribute('data-query')) {
        currentAn = anElement.getAttribute('data-query');
        console.log('BetterIncoPat调试：从申请号链接元素获取申请号=' + currentAn);
      }

      // 方案2：从表格行中查找包含"申请号"的td元素
      if (!currentAn) {
        const rows = document.querySelectorAll('tr');
        console.log('BetterIncoPat调试：方案2找到表格行数量=' + rows.length);
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2 && cells[0].textContent.trim() === '申请号') {
            console.log('BetterIncoPat调试：找到申请号行，第2个单元格内容=', cells[1].innerHTML);
            const anLink = cells[1].querySelector('a[data-key="AN"]');
            if (anLink && anLink.getAttribute('data-query')) {
              currentAn = anLink.getAttribute('data-query');
              console.log('BetterIncoPat调试：从表格行获取申请号=' + currentAn);
              break;
            }
          }
        }
      }

      // 方案3：从时间轴标签中查找申请号
      if (!currentAn) {
        const timelineLabels = document.querySelectorAll('.pn-name.timeline-pn-label');
        console.log('BetterIncoPat调试：方案3找到时间轴标签数量=' + timelineLabels.length);
        for (const label of timelineLabels) {
          if (label.textContent.trim() === '申请号') {
            const valueElement = label.nextElementSibling;
            console.log('BetterIncoPat调试：找到申请号标签，相邻元素=', valueElement);
            if (valueElement && valueElement.classList.contains('pn-value')) {
              currentAn = valueElement.textContent.trim();
              console.log('BetterIncoPat调试：从时间轴获取申请号=' + currentAn);
              break;
            }
          }
        }
      }

      if (!currentAn) {
        console.log('BetterIncoPat调试：所有方案均未找到申请号');
      }
    }

    // 只有公开号是必需的，申请号可以为空
    if (!currentPn) {
      console.error("BetterIncoPat: 无法获取公开号");
      return;
    }

    // 获取标题：优先从DOM元素获取，其次从patentList获取
    let title = "";
    const titleElement = document.querySelector("#currentPnTitle_fullTitle") || document.querySelector("#currentPnTitle_truncatedTitle");
    if (titleElement && titleElement.textContent) {
      title = titleElement.textContent.trim();
    }
    // 如果DOM中没有，尝试从patentList获取
    if (!title && pageScope.patentList) {
      let currentIndex = 0;

      // 当patentList只有1项时（如未登录通过URL直接打开），直接使用索引0
      if (pageScope.patentList.length === 1) {
        currentIndex = 0;
      } else {
        // 正常情况下，根据页面显示索引计算
        const currentIndexElement = document.querySelector("#resultList_current") || document.querySelector("#currentPnIndex");
        const solrQueryBean = pageScope.solrQueryBeanDetailNew || pageScope.solrQueryBean;
        const startRow = solrQueryBean ? parseInt(solrQueryBean.startRow || 0) : 0;

        if (currentIndexElement && currentIndexElement.textContent) {
          const displayIndex = parseInt(currentIndexElement.textContent.trim());
          if (!isNaN(displayIndex) && displayIndex > 0) {
            currentIndex = displayIndex - startRow - 1;
          }
        }
      }
      const patentData = pageScope.patentList[currentIndex];
      if (patentData && patentData.title) {
        try {
          title = JSON.parse('"' + patentData.title + '"');
        } catch (e) {
          title = patentData.title;
        }
      }
    }
    if (!title) title = "未知标题";

    // 等待data-pnk加载
    function waitForDataPnk(callback, maxAttempts = 20) {
      let attempts = 0;
      const checkInterval = setInterval(() => {
        const shareBtn = document.querySelector("#shareBtn");
        if (shareBtn && shareBtn.dataset.pnk) {
          clearInterval(checkInterval);
          callback(shareBtn.dataset.pnk);
        } else if (++attempts >= maxAttempts) {
          clearInterval(checkInterval);
          if (shareBtn) {
            shareBtn.click();
            setTimeout(() => {
              document.querySelector("#closeShare")?.click();
              if (shareBtn.dataset.pnk) callback(shareBtn.dataset.pnk);
            }, 500);
          }
        }
      }, 200);
    }

    waitForDataPnk((encryptedPnk) => {
      const url = `https://www.incopat.com/detail/init2?formerQuery=${encryptedPnk}`;
      const num = currentPn;
      const combinedInfo = `${num}\t${title}\t${url}`;

      // 找到标签容器
      const patentLabels = document.querySelector("#patentLabels");
      if (!patentLabels) {
        console.error("BetterIncoPat: 找不到标签容器");
        return;
      }

      // 隐藏原有的公开号和标题显示
      const currentPatentNumber = document.querySelector("#currentPatentNumber");
      if (currentPatentNumber) {
        currentPatentNumber.style.display = 'none';
      }
      const currentPnTitle = document.querySelector("#currentPnTitle");
      if (currentPnTitle) {
        currentPnTitle.style.display = 'none';
      }

      // 创建按钮
      function createButton(text, titleTip, onClick) {
        const btn = document.createElement("a");
        btn.textContent = text;
        btn.style.cssText = 'cursor: pointer; padding: 4px 10px; margin-left: 6px; border-radius: 3px; text-decoration: none; font-size: 14px; line-height: normal; display: inline-block; border: 1px solid #ccc; white-space: nowrap; transition: all 0.2s; background-color: #fff;';
        if (titleTip) btn.title = titleTip;
        btn.addEventListener("mouseenter", () => {
          btn.style.backgroundColor = '#e8e8e8';
          btn.style.borderColor = '#007bff';
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.backgroundColor = '#fff';
          btn.style.borderColor = '#ccc';
        });
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          onClick();
        });
        patentLabels.appendChild(btn);
        return btn;
      }

      // 创建所有按钮
      createButton(currentPn, "点击复制公开号", () => GM_setClipboard(currentPn));
      createButton(
        title.length < 30 ? title : title.slice(0, 30) + "...",
        title,
        () => GM_setClipboard(title)
      );
      createButton("链接", url, () => GM_setClipboard(url));
      createButton("号码、标题、链接", combinedInfo, () => GM_setClipboard(combinedInfo));

      // 官方网站按钮
      const openOffsiteBtn = createButton("官方网站", "", () => {});
      let anUrlDownloadBtn;
      let officialURL = "";
      let officialNumber = "";

      // 官方网站链接不一定需要申请号；只有 AN.url 下载才需要申请号
      if (/^CN\d+(?:[ABCDSUY]\d?)?$/i.test(num)) {
        openOffsiteBtn.textContent = "国家知识产权局";
        officialNumber = num;
        officialURL = `http://epub.cnipa.gov.cn/patent/${officialNumber}`;
        openOffsiteBtn.onclick = () => window.open(officialURL);
      } else if (/^TW([IM]?\d+)/i.test(num)) {
        openOffsiteBtn.textContent = "台湾经济部智慧财产局";
        officialNumber = num.match(/^TW([IM]?\d+)/i)[1];
        officialURL = `https://tiponet.tipo.gov.tw/twpat3/twpatc/twpatkm?!!FRURL${officialNumber}`;
        openOffsiteBtn.onclick = () => window.open(officialURL);
        if (currentAn) {
          anUrlDownloadBtn = createButton("AN.url下载", "", () => {
            CreateURLfileAndDownload(officialURL, currentAn);
          });
        }
      } else if (/^EP(\d+)/i.test(num) && currentAn) {
        openOffsiteBtn.textContent = "欧洲专利局";
        officialNumber = currentAn;
        officialURL = `https://worldwide.espacenet.com/patent/search?q=ap%3D${officialNumber}`;
        openOffsiteBtn.onclick = () => window.open(officialURL);
        anUrlDownloadBtn = createButton("AN.url下载", "", () => {
          CreateURLfileAndDownload(officialURL, currentAn);
        });
      } else if (/^EU(\d{13})S/i.test(num)) {
        openOffsiteBtn.textContent = "欧盟知识产权局";
        officialNumber = currentPn.slice(2,-5) + "-" + currentPn.slice(-5, -1);
        officialURL = `https://euipo.europa.eu/eSearch/#details/designs/${officialNumber}`;
        openOffsiteBtn.onclick = () => window.open(officialURL);
        if (currentAn) {
          anUrlDownloadBtn = createButton("AN.url下载", "", () => {
            CreateURLfileAndDownload(officialURL, currentPn.slice(0, -1));
          });
        }
      } else if (currentPnc.in_array("FR")) {
        openOffsiteBtn.textContent = "法国国家工业产权局";
        let officialNumber = currentPn.replace(/^FR(\d{7,8})[A-Z]\d?$/i, 'FR$1');
        officialURL = `https://data.inpi.fr/brevets/${officialNumber}`;
        openOffsiteBtn.onclick = () => window.open(officialURL);
        if (currentAn) {
          anUrlDownloadBtn = createButton("AN.url下载", "", () => {
            CreateURLfileAndDownload(officialURL, currentAn);
          });
        }
      } else if (/^RU(\d+)S/i.test(num)) {
        openOffsiteBtn.textContent = "俄罗斯联邦知识产权局";
        officialNumber = currentPn.slice(2,-1).padStart(8, "0");
        officialURL = `https://www.fips.ru/cdfi/fips.dll?ty=29&docid=${officialNumber}&ki=S`;
        openOffsiteBtn.onclick = () => window.open(officialURL);
        if (currentAn) {
          anUrlDownloadBtn = createButton("AN.url下载", "", () => {
            CreateURLfileAndDownload(officialURL, "RU" + officialNumber + "S");
          });
        }
      } else if (/^US(\d+)/i.test(num) && currentAn) {
        openOffsiteBtn.textContent = "美国专利商标局";
        const m = currentAn.match(/US(\d+)/i);
        officialNumber = m ? m[1] : "000000";
        officialURL = `https://globaldossier.uspto.gov/#/result/application/US/${officialNumber}/123456`;
        openOffsiteBtn.onclick = () => window.open(officialURL);
        anUrlDownloadBtn = createButton("AN.url下载", "", () => {
          CreateURLfileAndDownload(officialURL, currentAn);
        });
      } else if (/WO(?:[A-Z]{2})?(\d+)/i.test(num)) {
        openOffsiteBtn.textContent = "世界知识产权组织";
        const w = num.match(/WO(?:[A-Z]{2})?(\d+)/i);
        officialNumber = w ? w[1] : "";
        officialURL = `https://patentscope2.wipo.int/search/zh/detail.jsf?docId=WO${officialNumber}`;
        openOffsiteBtn.onclick = () => window.open(officialURL);
        if (currentAn) {
          anUrlDownloadBtn = createButton("AN.url下载", "", () => {
            CreateURLfileAndDownload(officialURL, currentAn);
          });
        }
      } else if (currentPnc.in_array("KR") && currentAn) {
        openOffsiteBtn.textContent = "韩国知识产权局";
        officialNumber = currentAn.slice(2);
        officialURL = `https://doi.org/10.8080/${officialNumber}`;
        openOffsiteBtn.onclick = () => window.open(officialURL);
        anUrlDownloadBtn = createButton("AN.url下载", "", () => {
          CreateURLfileAndDownload(officialURL, currentAn);
        });
      } else if (currentPnc.in_array("CA") && currentAn) {
        openOffsiteBtn.textContent = "加拿大知识产权局";
        officialNumber = currentAn.slice(2);
        officialURL = `https://www.ic.gc.ca/opic-cipo/cpd/eng/patent/${officialNumber}/summary.html`;
        openOffsiteBtn.onclick = () => window.open(officialURL);
        anUrlDownloadBtn = createButton("AN.url下载", "", () => {
          CreateURLfileAndDownload(officialURL, currentAn);
        });
      } else if (currentPnc.in_array("AU") && currentAn) {
        openOffsiteBtn.textContent = "澳大利亚知识产权局";
        officialNumber = currentAn.slice(2);
        officialURL = `http://pericles.ipaustralia.gov.au/ols/auspat/applicationDetails.do?applicationNo=${officialNumber}`;
        openOffsiteBtn.onclick = () => window.open(officialURL);
        anUrlDownloadBtn = createButton("AN.url下载", "", () => {
          CreateURLfileAndDownload(officialURL, currentAn);
        });
      } else if (currentPnc.in_array("JP") && currentAn && (currentAn.match(/JP[TS]?-?(?:19|20)\d{2}\d{6}[U]?/i) || currentAd.match(/^\d{8}$/))) {
        openOffsiteBtn.textContent = "日本特许厅";
        const jpAnMatch = currentAn.match(/JP[TS]?-?(?<year>\d{2,4})(?<sn>\d{6})[U]?/i);
        if (jpAnMatch) {
          const yearInAn = jpAnMatch.groups.year;
          const sn = jpAnMatch.groups.sn;
          const year = (yearInAn.length === 4 && (/^(?:19|20)\d{2}/i.test(yearInAn))) ? yearInAn : currentAd.slice(0, 4);
          const officialNumber = `JP-${year}-${sn}`;
          let officialURL = `https://www.j-platpat.inpit.go.jp/c1801/PU/${officialNumber}/10/en`;
          openOffsiteBtn.onclick = () => window.open(officialURL);
          anUrlDownloadBtn = createButton("AN.url下载", "", () => {
            CreateURLfileAndDownload(officialURL, currentAn);
          });
        }
      } else {
        // 没有官网链接的情况：有申请号则显示申请号按钮；否则隐藏官方网站按钮
        openOffsiteBtn.remove();
        if (currentAn) {
          createButton(currentAn, "点击复制申请号", () => GM_setClipboard(currentAn));
        } else {
          console.log("BetterIncoPat: 未找到申请号，且未匹配到可仅用公开号生成的官方网站链接");
        }
      }

      // PN.url下载按钮
      createButton("PN.url下载", "", () => {
        CreateURLfileAndDownload(url, num);
      });
    });
  }

  function DOM_ContentReady() {
    console.log("==> DOMContentLoaded");
    SkipPdfNameSelectDialog();
    // 延迟执行，等待页面索引和DOM元素完全加载
    setTimeout(() => {
      AddCopyButtons();
    }, 800);
  }

  function pageFullyLoaded() {
    console.log("==> window onload (所有资源都加载完)");
  }

  function Main() {
    AddCustomStyle();
    // 在 DOMContentLoaded 时再执行后面的按钮插入操作
    document.addEventListener("DOMContentLoaded", DOM_ContentReady);
    // onload 只是做一个示例，具体可不需要
    window.addEventListener("load", pageFullyLoaded);
  }

  Main();

})();