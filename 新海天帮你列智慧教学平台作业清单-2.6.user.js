// ==UserScript==
// @name         新海天帮你列智慧教学平台作业清单
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  V2.6: 新增 "Star本项目" 按钮，方便用户收藏支持。
// @author       上条当咩&&Gemini
// @match        http://123.121.147.7:88/*
// @license      MIT
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      123.121.147.7
// @downloadURL https://update.greasyfork.org/scripts/538889/%E6%96%B0%E6%B5%B7%E5%A4%A9%E5%B8%AE%E4%BD%A0%E5%88%97%E6%99%BA%E6%85%A7%E6%95%99%E5%AD%A6%E5%B9%B3%E5%8F%B0%E4%BD%9C%E4%B8%9A%E6%B8%85%E5%8D%95.user.js
// @updateURL https://update.greasyfork.org/scripts/538889/%E6%96%B0%E6%B5%B7%E5%A4%A9%E5%B8%AE%E4%BD%A0%E5%88%97%E6%99%BA%E6%85%A7%E6%95%99%E5%AD%A6%E5%B9%B3%E5%8F%B0%E4%BD%9C%E4%B8%9A%E6%B8%85%E5%8D%95.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // API 基础 URL
    const BASE_URL = 'http://123.121.147.7:88/ve';
    // 全局变量
    let allHomeworkData = [];
    let sortOrder = 'desc'; // 'asc' 或 'desc'
    let currentFilter = 'all';

    // --- 1. 创建 UI 元素 ---

    // 注入CSS样式
    GM_addStyle(`
        #homework-checker-btn {
            position: fixed; top: 70px; right: 150px; z-index: 9999;
            padding: 8px 15px; background-color: #007bff; color: white;
            border: none; border-radius: 5px; cursor: pointer; font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        #homework-checker-btn:hover { background-color: #0056b3; }
        #homework-modal {
            display: none; position: fixed; z-index: 10000;
            left: 0; top: 0; width: 100%; height: 100%;
            overflow: auto; background-color: rgba(0,0,0,0.5);
            font-family: Arial, sans-serif;
        }
        .modal-content {
            position: relative; /* 为绝对定位的子元素提供上下文 */
            background-color: #fefefe; margin: 5% auto; padding: 20px;
            border: 1px solid #888; width: 80%; max-width: 1200px;
            border-radius: 8px;
        }
        .modal-close {
            color: #aaa; float: right; font-size: 28px;
            font-weight: bold; cursor: pointer;
        }
        /* 新增的小人图像样式 */
        #mascot-img {
            position: absolute;
            top: 5px;
            right: 60px; /* 调整位置，使其在关闭按钮旁边 */
            max-height: 100px; /* 控制图像大小 */
            user-select: none; /* 防止用户选中图像 */
        }
        #homework-status { font-size: 16px; margin-bottom: 10px; }
        #homework-filters { margin-bottom: 15px; display: flex; align-items: center; }
        .filter-tag {
            display: inline-block; padding: 5px 12px; margin-right: 8px;
            border: 1px solid #ccc; border-radius: 15px;
            cursor: pointer; font-size: 13px;
        }
        .filter-tag:hover { background-color: #f0f0f0; }
        .filter-tag.active {
            background-color: #007bff; color: white; border-color: #007bff;
        }
        /* “Star本项目”按钮的样式 */
        #star-repo-btn {
            display: inline-block;
            padding: 5px 12px;
            margin-left: 15px; /* 与左侧标签的间距 */
            background-color: #e53935; /* 红色背景 */
            color: white;
            text-decoration: none;
            border-radius: 15px;
            font-size: 13px;
            font-weight: bold;
            transition: background-color 0.2s ease-in-out;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        #star-repo-btn:hover {
            background-color: #c62828; /* 鼠标悬停时颜色变深 */
        }
        #homework-list { margin-top: 10px; max-height: 65vh; overflow-y: auto; }
        #homework-list table { width: 100%; border-collapse: collapse; }
        #homework-list th, #homework-list td {
            border: 1px solid #ddd; padding: 10px; text-align: left;
            font-size: 14px;
        }
        #homework-list th {
            background-color: #f2f2f2; position: sticky; top: -1px;
        }
        .sortable { cursor: pointer; }
        .sortable:hover { background-color: #e8e8e8; }
        .sort-asc::after { content: ' ▲'; font-size: 10px; }
        .sort-desc::after { content: ' ▼'; font-size: 10px; }
        .status-pending { color: red; font-weight: bold; }
        .status-submitted { color: grey; }
        .status-graded { color: green; }
        .past-due { background-color: #fbecec !important; }
        .urgency-high { background-color: #ffebee !important; }
        .urgency-medium { background-color: #fffde7 !important; }
        .urgency-low { background-color: #e3f2fd !important; }
    `);

    const button = document.createElement('button');
    button.id = 'homework-checker-btn';
    button.innerHTML = '一键获取作业';
    document.body.appendChild(button);

    const modal = document.createElement('div');
    modal.id = 'homework-modal';
    // 在弹窗HTML中添加img元素，并设置onerror事件
    modal.innerHTML = `
        <div class="modal-content">
            <span class="modal-close">&times;</span>
            <img id="mascot-img" src="https://love.nimisora.icu/homework-notify/nimisora.png" alt="Mascot" onerror="this.style.display='none'">
            <h2>作业清单</h2>
            <div id="homework-status">点击按钮开始获取...</div>
            <div id="homework-filters"></div>
            <div id="homework-list"></div>
        </div>
    `;
    document.body.appendChild(modal);

    // --- 2. 核心逻辑 ---

    function gmFetch(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET', url: url,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 400) {
                        try {
                            const jsonData = JSON.parse(response.responseText);
                            if (typeof jsonData === 'string' && jsonData.includes("您还未登录")) {
                                reject(new Error("会话已过期或未登录，请重新登录。"));
                                return;
                            }
                            resolve(jsonData);
                        } catch (e) { reject(new Error("响应内容不是有效的JSON格式。")); }
                    } else { reject(new Error(`请求失败，HTTP状态码: ${response.status}`)); }
                },
                onerror: (error) => reject(new Error(`网络请求错误: ${error}`))
            });
        });
    }

    async function fetchSemesterInfo() {
        const url = `${BASE_URL}/back/rp/common/teachCalendar.shtml?method=queryCurrentXq`;
        const data = await gmFetch(url);
        if (data.result && data.result.length > 0) return data.result[0].xqCode;
        throw new Error("获取学期信息失败。");
    }

    async function fetchCourseList(xqCode) {
        const url = `${BASE_URL}/back/coursePlatform/course.shtml?method=getCourseList&pagesize=100&page=1&xqCode=${xqCode}`;
        const data = await gmFetch(url);
        if (data.courseList) return data.courseList;
        throw new Error("获取课程列表失败。");
    }

    async function fetchAllHomeworkForCourse(course) {
        const homeworkTypes = [
            { subType: 0, name: "普通作业" }, { subType: 1, name: "课程报告" }, { subType: 2, name: "实验作业" }
        ];
        const promises = homeworkTypes.map(async (type) => {
            const url = `${BASE_URL}/back/coursePlatform/homeWork.shtml?method=getHomeWorkList&cId=${course.id}&subType=${type.subType}&page=1&pagesize=100`;
            try {
                const data = await gmFetch(url);
                if (data.courseNoteList && data.courseNoteList.length > 0) {
                    return data.courseNoteList.map(hw => ({ ...hw, courseName: course.name, homeworkType: type.name }));
                }
            } catch (error) { console.error(`获取 [${course.name}] 的 [${type.name}] 失败:`, error); }
            return [];
        });
        const results = await Promise.all(promises);
        return results.flat();
    }

    function getUrgencyScore(homework) {
        const now = new Date();
        const deadline = new Date(homework.end_time);
        const diffHours = (deadline - now) / (1000 * 60 * 60);

        if (diffHours < 0) return 4;
        if (diffHours < 24) return 1;
        if (diffHours < 48) return 2;
        return 3;
    }

    function sortHomeworkInPlace() {
        allHomeworkData.sort((a, b) => {
            const isAUnsubmitted = a.subStatus === '未提交';
            const isBUnsubmitted = b.subStatus === '未提交';

            if (isAUnsubmitted !== isBUnsubmitted) {
                return isBUnsubmitted - isAUnsubmitted;
            }

            if (isAUnsubmitted && isBUnsubmitted) {
                const urgencyA = getUrgencyScore(a);
                const urgencyB = getUrgencyScore(b);
                if (urgencyA !== urgencyB) {
                    return urgencyA - urgencyB;
                }
            }

            const dateA = new Date(a.end_time);
            const dateB = new Date(b.end_time);
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
    }

    function formatDeadline(dateString) {
        if (!dateString) return 'N/A';
        let date = new Date(dateString);
        if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
            date.setSeconds(date.getSeconds() - 1);
        }
        return date.getFullYear() + '-'
            + ('0' + (date.getMonth() + 1)).slice(-2) + '-'
            + ('0' + date.getDate()).slice(-2) + ' '
            + ('0' + date.getHours()).slice(-2) + ':'
            + ('0' + date.getMinutes()).slice(-2) + ':'
            + ('0' + date.getSeconds()).slice(-2);
    }

    function renderHomeworkTable(homeworks) {
        const listDiv = document.getElementById('homework-list');
        if (homeworks.length === 0) {
            listDiv.innerHTML = '<p style="font-size: 16px; color: green;">当前筛选条件下没有作业！</p>';
            return;
        }

        let tableHTML = `<table><thead><tr>
            <th>课程名称</th><th>作业标题</th><th>类型</th>
            <th class="sortable" id="deadline-header">截止时间</th>
            <th>剩余时间</th><th>状态</th><th>分数</th>
            </tr></thead><tbody>`;

        const now = new Date();
        homeworks.forEach(hw => {
            let statusText, statusClass, rowClass = '';
            const isGraded = hw.stu_score !== null && hw.stu_score !== undefined && hw.stu_score !== '未公布成绩';
            const isSubmitted = hw.subStatus === '已提交';

            let remainingTimeText = ' - ';
            if (!isSubmitted && !isGraded) {
                const deadline = new Date(hw.end_time);
                const diffMillis = deadline - now;
                const diffHours = diffMillis / (1000 * 60 * 60);

                if (diffHours < 0) {
                    remainingTimeText = '<span style="color:red;">已截止</span>';
                    rowClass = 'past-due';
                } else {
                    remainingTimeText = `${Math.floor(diffHours)} 小时`;
                    if (diffHours < 24) rowClass = 'urgency-high';
                    else if (diffHours < 48) rowClass = 'urgency-medium';
                    else rowClass = 'urgency-low';
                }
            }

            if (isGraded) {
                statusText = '已批阅'; statusClass = 'status-graded';
            } else if (isSubmitted) {
                statusText = '已提交'; statusClass = 'status-submitted';
            } else {
                statusText = '未提交'; statusClass = 'status-pending';
            }

            tableHTML += `<tr class="${rowClass}">
                <td>${hw.courseName || 'N/A'}</td><td>${hw.title || 'N/A'}</td>
                <td>${hw.homeworkType || 'N/A'}</td><td>${formatDeadline(hw.end_time)}</td>
                <td>${remainingTimeText}</td><td class="${statusClass}">${statusText}</td>
                <td>${isGraded ? hw.stu_score : ' - '}</td></tr>`;
        });
        tableHTML += '</tbody></table>';
        listDiv.innerHTML = tableHTML;

        addSortingFunctionality();
    }

    function addSortingFunctionality() {
        const deadlineHeader = document.getElementById('deadline-header');
        if (deadlineHeader) {
            deadlineHeader.classList.remove('sort-asc', 'sort-desc');
            deadlineHeader.classList.add(sortOrder === 'asc' ? 'sort-asc' : 'sort-desc');
            deadlineHeader.onclick = () => {
                sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
                sortHomeworkInPlace();
                filterAndRender(currentFilter);
            };
        }
    }

    function setupFilters() {
        const filters = [
            { id: 'all', text: '全部作业' }, { id: 'pending', text: '未提交' },
            { id: 'submitted', text: '待批改' }, { id: 'graded', text: '已批阅' },
            { id: 'overdue', text: '已截止(未交)' },
        ];
        const filtersContainer = document.getElementById('homework-filters');

        // 生成过滤器标签的 HTML
        const filtersHTML = filters.map(f => `<span class="filter-tag" data-filter="${f.id}">${f.text}</span>`).join('');

        // 创建 "Star本项目" 按钮的 HTML
        const starButtonHTML = `
            <a href="https://github.com/10086mea/nimisora-homowork-notify/" target="_blank" id="star-repo-btn">
                ❤️ Star本项目
            </a>
        `;

        // 将过滤器和按钮一起放入容器
        filtersContainer.innerHTML = filtersHTML + starButtonHTML;

        // 为过滤器标签添加点击事件监听
        filtersContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-tag')) {
                currentFilter = e.target.dataset.filter;
                filtersContainer.querySelectorAll('.filter-tag').forEach(tag => tag.classList.remove('active'));
                e.target.classList.add('active');
                filterAndRender(currentFilter);
            }
        });
        // 默认激活 "全部作业" 过滤器
        filtersContainer.querySelector('.filter-tag[data-filter="all"]').classList.add('active');
    }

    function filterAndRender(filterType) {
        let filteredData = [];
        const now = new Date();
        const dataToFilter = [...allHomeworkData];

        switch (filterType) {
            case 'pending':
                filteredData = dataToFilter.filter(hw => hw.subStatus === '未提交');
                break;
            case 'submitted':
                filteredData = dataToFilter.filter(hw => hw.subStatus === '已提交' && hw.stu_score === '未公布成绩');
                break;
            case 'graded':
                filteredData = dataToFilter.filter(hw => hw.stu_score !== null && hw.stu_score !== undefined && hw.stu_score !== '未公布成绩');
                break;
            case 'overdue':
                filteredData = dataToFilter.filter(hw => new Date(hw.end_time) < now && hw.subStatus === '未提交');
                break;
            case 'all':
            default:
                filteredData = dataToFilter;
                break;
        }
        renderHomeworkTable(filteredData);
    }

    // --- 3. 事件绑定 ---

    button.onclick = async () => {
        modal.style.display = 'block';
        const statusDiv = document.getElementById('homework-status');
        const listDiv = document.getElementById('homework-list');
        statusDiv.innerHTML = '🚀 新海天正在获取作业信息...';
        listDiv.innerHTML = '';
        document.getElementById('homework-filters').innerHTML = '';

        try {
            const xqCode = await fetchSemesterInfo();
            const courses = await fetchCourseList(xqCode);
            if (!courses || courses.length === 0) {
                statusDiv.textContent = '✅ 当前学期没有课程。';
                return;
            }

            statusDiv.innerHTML = `新海天正在从 ${courses.length} 门课程中获取作业...`;
            const homeworkByCourse = await Promise.all(courses.map(c => fetchAllHomeworkForCourse(c)));
            allHomeworkData = homeworkByCourse.flat();

            sortHomeworkInPlace();

            setupFilters();
            currentFilter = 'all';
            filterAndRender(currentFilter);
            statusDiv.textContent = `🎉 获取完成！新海天共找到 ${allHomeworkData.length} 项作业。`;

        } catch (error) {
            console.error("获取作业失败:", error);
            statusDiv.innerHTML = `<span style="color:red;">❌ 获取作业失败: ${error.message}</span>`;
        }
    };

    modal.querySelector('.modal-close').onclick = () => { modal.style.display = 'none'; };
    window.onclick = (event) => { if (event.target == modal) { modal.style.display = 'none'; } };

})();
