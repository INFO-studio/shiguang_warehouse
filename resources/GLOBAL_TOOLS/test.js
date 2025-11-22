const getStudentId = () => document.querySelector('.trigger-user-name').innerText.match(/\[(.*?)\]/)?.[1]

const checkLogin = () => window.location.hostname === 'my.cqu.edu.cn' && getStudentId() !== undefined

const getAccessToken = () => localStorage.getItem('cqu_edu_ACCESS_TOKEN').replaceAll('"', '')

const baseFetch = async (url, accessToken, method, body, description) => {
    const response = await fetch(
        url,
        {
            method,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body,
        }
    )
    if (!response.ok) {
        AndroidBridge.showToast(`获取${description}失败: ${termResponse.status} ${termResponse.statusText}`)//, `获取${description}失败，请退出重试`)
        throw new Error(`获取${description}失败: ${termResponse.status} ${termResponse.statusText}`)
    }
    return await response.json()
}

const getTermId = async (accessToken) => (await baseFetch('https://my.cqu.edu.cn/api/resourceapi/session/info-detail', accessToken, 'GET', null, '学期信息')).curSessionId

const getStartDate = async (termId, accessToken) => (new Date((await baseFetch(`https://my.cqu.edu.cn/api/resourceapi/session/info/${termId}`, accessToken, 'GET', null, '学期详情')).data.beginDate).toISOString().split('T')[0])

const getMaxWeek = async (termId, accessToken) => await baseFetch(`https://my.cqu.edu.cn/api/timetable/course/maxWeek/${termId}`, accessToken, 'GET', null, '最大周数')

const getTimeSlots = async (accessToken) => (await baseFetch('https://my.cqu.edu.cn/api/workspace/time-pattern/session-time-pattern', accessToken, 'GET', null, '时间段配置')).data.classPeriodVOS

const getSchedule = async (termId, accessToken, studentId) => (await baseFetch(`https://my.cqu.edu.cn/api/timetable/class/timetable/student/my-table-detail?sessionId=${termId}`, accessToken, 'POST', JSON.stringify([studentId]), '课程表')).classTimetableVOList

const parseSchedule = (startDate, maxWeek, timeSlots, schedule) => console.log(timeSlots) || ({
    courseConfig: {
        semesterStartDate: startDate,
        totalWeeks: maxWeek,
    },
    timeSlots: timeSlots.map((timeSlot, index) => ({
        number: timeSlot.periodOrder ?? index + 1,
        startTime: timeSlot.startTime ?? '',
        endTime: timeSlot.endTime ?? '',
    })) + [
        {number: 1, startTime: "08:30", endTime: "09:15"},
        {number: 2, startTime: "09:25", endTime: "10:10"},
        {number: 3, startTime: "10:30", endTime: "11:15"},
        {number: 4, startTime: "11:25", endTime: "12:10"},
        {number: 5, startTime: "13:30", endTime: "14:15"},
        {number: 6, startTime: "14:25", endTime: "15:10"},
        {number: 7, startTime: "15:30", endTime: "16:15"},
        {number: 8, startTime: "16:25", endTime: "17:10"},
        {number: 9, startTime: "17:20", endTime: "18:05"},
        {number: 10, startTime: "19:00", endTime: "19:45"},
        {number: 11, startTime: "19:55", endTime: "20:40"},
        {number: 12, startTime: "20:50", endTime: "21:35"},
    ],
    courses: schedule.map((course) => ({
        name: course.courseName ?? '',
        teacher: course.instructorName?.slice(0, course.instructorName?.indexOf('-')) ?? '',
        position: course.position ?? '',
        day: course.weekDay ?? 0,
        startSection: (course.periodFormat?.indexOf('-') ?? 0) > 0 ? (Number(course.periodFormat?.split('-')[0]) + 1) : (Number(course.periodFormat) + 1) ?? 0,
        endSection: (course.periodFormat?.indexOf('-') ?? 0) > 0 ? (Number(course.periodFormat?.split('-')[1]) + 1) : (Number(course.periodFormat) + 1) ?? 0,
        weeks: (course.teachingWeek ?? '').split('').map((char, index) => (char === '1' ? index + 1 : null)).filter(week => week !== null),
    })),
})

const saveSchedule = (parsedSchedule) => {
    return Promise.allSettled([
        window.AndroidBridgePromise.saveCourseConfig(JSON.stringify(parsedSchedule?.courseConfig)),
        window.AndroidBridgePromise.saveImportedCourses(JSON.stringify(parsedSchedule?.courses)),
        window.AndroidBridgePromise.savePresetTimeSlots(JSON.stringify(parsedSchedule?.timeSlots)),
    ])
}

(async () => {
    if (!checkLogin()) {
        AndroidBridge.showToast("尚未登录重庆大学教务系统，请先登录！")
        throw new Error("未检测到登录状态")
    }
    
    const studentId = getStudentId()
    
    const accessToken = getAccessToken()

    if (!accessToken) {
        AndroidBridge.showToast("尚未登录")
        throw new Error("未找到访问令牌，请确保已登录 my.cqu.edu.cn")
    }

    const termId = await getTermId(accessToken)

    console.log(await Promise.allSettled([getStartDate(termId, accessToken), getMaxWeek(termId, accessToken), getTimeSlots(accessToken), getSchedule(termId, accessToken, studentId)]))

    await saveSchedule(parseSchedule(...(await Promise.allSettled([getStartDate(termId, accessToken), getMaxWeek(termId, accessToken), getTimeSlots(accessToken), getSchedule(termId, accessToken, studentId)])).map(result => result.value)))

    AndroidBridge.notifyTaskCompletion()
})()