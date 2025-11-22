const getStudentId = () => document.querySelector('.trigger-user-name').innerText.match(/\[(.*?)\]/)?.[1]

const checkLogin = () => window.location.hostname === 'my.cqu.edu.cn' && getStudentId() !== undefined

const getAccessToken = () => localStorage.getItem('cqu_edu_ACCESS_TOKEN').replaceAll('"', '')

const getTermId = async (accessToken) => {
    const termResponse = await fetch(
        'https://my.cqu.edu.cn/api/resourceapi/session/info-detail',
        {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
        }
    )
    if (!termResponse.ok) {
        AndroidBridge.showToast("获取学期信息失败，请退出重试")
        throw new Error(`获取学期信息失败: ${termResponse.status} ${termResponse.statusText}`)
    }
    return (await termResponse.json()).curSessionId
}

const getSchedule = async (termId, accessToken, studentId) => {
    const scheduleResponse = await fetch(
      `https://my.cqu.edu.cn/api/timetable/class/timetable/student/my-table-detail?sessionId=${termId}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify([studentId]),
      }
    )
    if (!scheduleResponse.ok) {
        AndroidBridge.showToast("获取课程表失败，请退出重试")
        throw new Error(`获取课程表失败: ${termResponse.status} ${termResponse.statusText}`)
    }
    return await scheduleResponse.json()
}

const parseSchedule = (schedule) => ({
    courses: schedule.classTimetableVOList.map((course) => ({
        name: course.courseName ?? '',
        teacher: course.instructorName?.slice(0, course.instructorName?.findIndex('-')) ?? '',
        position: course.position ?? '',
        day: course.weekDay ?? 0,
        startSection: (course.periodFormat?.findIndex('-') ?? 0) > 0 ? (Number(course.periodFormat?.split('-')[0]) + 1) : (Number(course.periodFormat) + 1) ?? 0,
        endSection: (course.periodFormat?.findIndex('-') ?? 0) > 0 ? (Number(course.periodFormat?.split('-')[1]) + 1) : (Number(course.periodFormat) + 1) ?? 0,
        weeks: (course.teachingWeek ?? '').split('').map((char, index) => (char === '1' ? index + 1 : null)).filter(week => week !== null),
    })),
    timeSlots: [
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
})

const saveSchedule = (parsedSchedule) => {
    return new Promise.allSettled([
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

    const termId = getTermId(accessToken)

    await saveSchedule(parseSchedule(await getSchedule(termId, accessToken, studentId)))

    AndroidBridge.notifyTaskCompletion()
})()