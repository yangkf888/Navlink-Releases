想要同步 Emby 的播放进度，主要通过向 Emby Server REST API 发送特定的 Playback Check-in 请求来实现。
核心操作分为以下三个步骤：
1. 播放开始 (Playback Start)
当用户开始播放时，发送一个 POST 请求告知服务器。
端点: /Sessions/Playing
作用: 初始化播放会话，让服务器知道哪个设备正在播放哪个媒体文件。 
2. 进度上报 (Playback Progress)
在播放过程中，你需要每隔 10 秒左右发送一次进度更新。 
端点: /Sessions/Playing/Progress
关键参数:
PositionTicks: 当前播放位置（单位为 10,000,000 刻度/秒，即 100ns）。
ItemId: 媒体文件的 ID。
EventName: 触发更新的事件（如 TimeUpdate, Pause, Unpause 等）。
注意: 即使不频繁发送，服务器也会尝试自动递增，但手动上报可以校准服务器端的记录，确保多端同步准确。 
3. 播放停止 (Playback Stopped)
播放结束或用户退出时，务必发送停止请求，否则服务器可能会认为该会话仍处于“挂起”状态。 
端点: /Sessions/Playing/Stopped
作用: 清除活跃会话，并将最终播放位置写入数据库。 

在开发 Emby 自定义客户端时，同步播放进度主要依靠 Playback Check-in（播放签到） 机制。以下是核心开发要点：
1. 身份验证与会话初始化
在发送进度前，确保请求头包含身份验证信息。
认证方式：推荐在 Header 中携带 X-Emby-Token。
获取 Token：通常通过 /Users/AuthenticateByName 接口使用用户名和密码登录获取。 
2. 播放状态上报流程
你需要在播放器的不同生命周期调用 Playback Check-ins 相关的三个 POST 接口： 
开始播放 (/Sessions/Playing)：
触发时机：用户点击播放，播放器准备就绪时。
关键字段：ItemId (媒体ID), CanSeek (是否支持进度条跳转), PlayMethod (DirectPlay 或 Transcode)。
注意：此接口会返回一个 PlaySessionId，必须记录此 ID 并用于后续所有进度请求，以确保服务器能匹配到正确的播放流。
进度更新 (/Sessions/Playing/Progress)：
触发时机：每 10 秒发送一次。此外，在用户暂停、恢复、调整音量或手动拖动进度条后应立即发送。
关键字段：
PositionTicks: 当前进度（1 秒 = 10,000,000 Ticks）。
EventName: 必须包含，例如 TimeUpdate, Pause, Unpause。
优化：如果媒体已暂停，请停止循环发送 Progress 请求，避免浪费带宽和产生冗余日志。
停止播放 (/Sessions/Playing/Stopped)：
触发时机：用户退出播放界面或视频播放完毕。
作用：告知服务器释放资源并保存最终播放位置。
开发技巧
单位转换：Emby 使用的是 Ticks (100纳秒单位)，转换公式为：Ticks = Seconds * 10,000,000。
自动递增：即便客户端不频繁上报，服务器也会根据 PlaySpeed 自动递增其显示的播放位置，但客户端上报的 Progress 用于校准，确保多设备间的“继续观看”功能准确无误