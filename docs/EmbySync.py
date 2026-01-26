import requests
from datetime import datetime

EMBY_LOCAL = {
    "name": "本地",
    "url": "",
    "api_key": "",
    "user_id": ""
}

EMBY_REMOTE = {
    "name": "远程",
    "url": "",
    "api_key": "",
    "user_id": ""
}


def now():
    return f"[{datetime.now().strftime('%H:%M:%S')}]"


def get_key(item):
    """
    统一获取剧集匹配键，优先使用 ProviderIds 中的 Tvdb 或 Tmdb 加季数集数，
    没有则退回使用 (SeriesName, ParentIndexNumber, IndexNumber) 。
    """
    provider_ids = item.get('ProviderIds', {})
    season = item.get('ParentIndexNumber')
    episode = item.get('IndexNumber')
    if provider_ids:
        if 'Tvdb' in provider_ids and season is not None and episode is not None:
            return ('Tvdb', provider_ids['Tvdb'], season, episode)
        if 'Tmdb' in provider_ids and season is not None and episode is not None:
            return ('Tmdb', provider_ids['Tmdb'], season, episode)
    # 退回旧方法
    series = item.get('SeriesName')
    if series and season is not None and episode is not None:
        return (series, season, episode)
    return None


def get_played_episodes(emby):
    print(f"{now()} 开始拉取【{emby['name']}】播放记录...")
    url = f"{emby['url']}/Users/{emby['user_id']}/Items"
    params = {
        "Recursive": "true",
        "IsPlayed": "true",
        "IncludeItemTypes": "Episode",
        "Fields": "SeriesName,ParentIndexNumber,IndexNumber,Name,ProviderIds"
    }
    headers = {"X-Emby-Token": emby["api_key"]}
    try:
        resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()
        episodes = {}
        for item in data.get("Items", []):
            key = get_key(item)
            if key:
                episodes[key] = (item['Id'], item.get('Name', '未知集名'))
        print(f"{now()} 获取到【{emby['name']}】播放记录 {len(episodes)} 条。")
        return episodes
    except Exception as e:
        print(f"{now()} 拉取【{emby['name']}】播放记录失败: {e}")
        return {}


def get_all_episodes(emby):
    print(f"{now()} 拉取【{emby['name']}】全部剧集信息...")
    url = f"{emby['url']}/Items"
    params = {
        "Recursive": "true",
        "IncludeItemTypes": "Episode",
        "Fields": "SeriesName,ParentIndexNumber,IndexNumber,Name,RunTimeTicks,ProviderIds",
        "Limit": 10000
    }
    headers = {"X-Emby-Token": emby["api_key"]}
    try:
        resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        items = resp.json().get("Items", [])
        episode_map = {}
        for item in items:
            key = get_key(item)
            if key:
                episode_map[key] = {
                    'id': item['Id'],
                    'series': item.get('SeriesName', '未知剧名'),
                    'season': item.get('ParentIndexNumber'),
                    'episode': item.get('IndexNumber'),
                    'name': item.get('Name', '未知集名'),
                    'runtime': item.get('RunTimeTicks', 0)
                }
        print(f"{now()} 共拉取到【{emby['name']}】剧集数: {len(episode_map)}")
        return episode_map
    except Exception as e:
        print(f"{now()} 拉取【{emby['name']}】剧集列表失败: {e}")
        return {}


def get_playback_progress(emby):
    print(f"{now()} 拉取【{emby['name']}】播放进度记录...")
    url = f"{emby['url']}/Users/{emby['user_id']}/Items"
    params = {
        "Recursive": "true",
        "IncludeItemTypes": "Episode",
        "Fields": "SeriesName,ParentIndexNumber,IndexNumber,UserData,ProviderIds",
        "Limit": 10000
    }
    headers = {"X-Emby-Token": emby["api_key"]}
    try:
        resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        items = resp.json().get("Items", [])

        progress_map = {}
        for item in items:
            key = get_key(item)
            if not key:
                continue
            user_data = item.get('UserData', {})
            position = user_data.get('PlaybackPositionTicks', 0)
            if position > 0:
                progress_map[key] = position

        print(f"{now()} 获取到【{emby['name']}】播放进度记录 {len(progress_map)} 条。")
        return progress_map
    except Exception as e:
        print(f"{now()} 拉取【{emby['name']}】播放进度失败: {e}")
        return {}


def mark_episode_played(emby, item_id):
    url = f"{emby['url']}/Users/{emby['user_id']}/PlayedItems/{item_id}"
    headers = {"X-Emby-Token": emby["api_key"]}
    try:
        res = requests.post(url, headers=headers)
        if res.status_code in (200, 204):
            print(f"{now()} 标记已观看成功：ItemId {item_id}")
            return True
        else:
            print(f"{now()} 标记失败，状态码: {res.status_code}，内容: {res.text[:100]}")
            return False
    except Exception as e:
        print(f"{now()} 标记请求异常: {e}")
        return False


def report_playback_progress(emby, item_id, position_ticks, runtime_ticks):
    url = f"{emby['url']}/Users/{emby['user_id']}/Items/{item_id}/UserData"
    headers = {
        "X-Emby-Token": emby["api_key"]
    }
    data = {
        "PlaybackPositionTicks": position_ticks,
        "PlayCount": 1,
        "Played": position_ticks > runtime_ticks * 0.9
    }
    try:
        res = requests.post(url, headers=headers, json=data)
        if res.status_code in (200, 204):
            print(f"{now()} 更新播放进度成功：ItemId {item_id} 位置 {position_ticks} ticks")
            return True
        else:
            print(f"{now()} 更新播放进度失败，状态码: {res.status_code}，内容: {res.text[:100]}")
            return False
    except Exception as e:
        print(f"{now()} 更新播放进度请求异常: {e}")
        return False


def sync_playback_progress(source, target):
    print(f"\n{now()} \n===== 开始从【{source['name']}】同步播放进度到【{target['name']}】 =====")
    source_progress = get_playback_progress(source)
    target_progress = get_playback_progress(target)
    target_episodes = get_all_episodes(target)

    updated_items = []

    for key, source_pos in source_progress.items():
        if key in target_episodes:
            ep = target_episodes[key]
            target_item_id = ep['id']
            target_pos = target_progress.get(key, 0)
            if source_pos > target_pos:
                if report_playback_progress(target, target_item_id, source_pos, ep['runtime']):
                    updated_items.append({
                        'series': ep['series'],
                        'season': ep['season'],
                        'episode': ep['episode'],
                        'episode_name': ep['name'],
                        'position_ticks': source_pos
                    })
        else:
            print(f"{now()} [WARN] 目标端不存在剧集 {key}，跳过进度同步")

    return updated_items


def sync_one_way(source, target):
    print(f"\n{now()} \n===== 开始从【{source['name']}】同步到【{target['name']}】 =====")
    source_episodes = get_played_episodes(source)
    target_episodes = get_played_episodes(target)
    target_all_episodes = get_all_episodes(target)

    synced_list = []
    for key in source_episodes:
        if key not in target_episodes:
            if key in target_all_episodes:
                ep = target_all_episodes[key]
                target_item_id = ep['id']
                if mark_episode_played(target, target_item_id):
                    synced_list.append({
                        'series': ep['series'],
                        'season': ep['season'],
                        'episode': ep['episode'],
                        'episode_name': ep['name']
                    })
            else:
                print(f"{now()} [WARN] 目标端不存在剧集 {key}，跳过。")

    return synced_list


def print_sync_details(direction, progress_list, played_list):
    print(f"\n{now()} ===== {direction} 播放进度同步详情 =====")
    if progress_list:
        for ep in progress_list:
            print(f"  - {ep['series']} S{ep['season']}E{ep['episode']} ：{ep['episode_name']}，位置：{ep['position_ticks']} ticks")
    else:
        print("  无播放进度同步记录。")

    print(f"\n{now()} ===== {direction} 已看剧集同步详情 =====")
    if played_list:
        for ep in played_list:
            print(f"  - {ep['series']} S{ep['season']}E{ep['episode']} ：{ep['episode_name']}")
    else:
        print("  无已看剧集同步记录。")


if __name__ == "__main__":
    lp2rp = sync_playback_progress(EMBY_LOCAL, EMBY_REMOTE)  # 本地->远程
    rp2lp = sync_playback_progress(EMBY_REMOTE, EMBY_LOCAL)  # 远程->本地

    lr2rp = sync_one_way(EMBY_LOCAL, EMBY_REMOTE)  # 本地->远程
    rr2lp = sync_one_way(EMBY_REMOTE, EMBY_LOCAL)  # 远程->本地

    print_sync_details("本地 -> 云端", lp2rp, lr2rp)
    print_sync_details("云端 -> 本地", rp2lp, rr2lp)
