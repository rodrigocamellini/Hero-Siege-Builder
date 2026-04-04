<?php
declare(strict_types=1);

function xml_escape(string $s): string {
  return htmlspecialchars($s, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

function sanitize_text(string $s): string {
  $s = str_replace('`', '', $s);
  return preg_replace('/[[:cntrl:]]/u', '', $s);
}

function date_rss_from_ts(?string $ts): string {
  if (!$ts) return gmdate(DATE_RSS);
  try {
    $dt = new DateTime($ts);
    $dt->setTimezone(new DateTimeZone('UTC'));
    return $dt->format(DATE_RSS);
  } catch (Exception $e) {
    return gmdate(DATE_RSS);
  }
}

function get_config(): array {
  $cfgPath = __DIR__ . '/rss-config.json';
  if (!is_file($cfgPath)) return [];
  $raw = file_get_contents($cfgPath);
  if ($raw === false) return [];
  $json = json_decode($raw, true);
  return is_array($json) ? $json : [];
}

function http_request(string $url, string $method = 'GET', ?string $body = null, int $timeout = 10): ?string {
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
    if ($method === 'POST') {
      curl_setopt($ch, CURLOPT_POST, true);
      curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
      curl_setopt($ch, CURLOPT_POSTFIELDS, $body ?? '');
    }
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $ch = null;
    if ($code >= 200 && $code < 300 && $res !== false) return $res;
    return null;
  }
  $opts = [
    'http' => [
      'method' => $method,
      'header' => $method === 'POST' ? "Content-Type: application/json\r\n" : "",
      'content' => $method === 'POST' ? ($body ?? '') : '',
      'timeout' => $timeout
    ]
  ];
  $ctx = stream_context_create($opts);
  $res = @file_get_contents($url, false, $ctx);
  if ($res === false) return null;
  return $res;
}

function firestore_run_query(string $projectId, string $apiKey, int $limit): array {
  $url = 'https://firestore.googleapis.com/v1/projects/' . rawurlencode($projectId) . '/databases/(default)/documents:runQuery?key=' . rawurlencode($apiKey);

  $body = [
    'structuredQuery' => [
      'from' => [
        ['collectionId' => 'website_updates']
      ],
      'orderBy' => [
        [
          'field' => ['fieldPath' => 'createdAt'],
          'direction' => 'DESCENDING'
        ]
      ],
      'limit' => $limit
    ]
  ];

  $res = http_request($url, 'POST', json_encode($body), 10);
  if ($res === null) return [];
  $json = json_decode($res, true);
  return is_array($json) ? $json : [];
}

function firestore_list_documents(string $projectId, string $apiKey, int $pageSize = 200): array {
  $url =
    'https://firestore.googleapis.com/v1/projects/' . rawurlencode($projectId) .
    '/databases/(default)/documents/website_updates?pageSize=' . $pageSize . '&key=' . rawurlencode($apiKey);
  $res = http_request($url, 'GET', null, 10);
  if ($res === null) return [];
  $json = json_decode($res, true);
  if (!is_array($json) || !isset($json['documents']) || !is_array($json['documents'])) return [];
  $out = [];
  foreach ($json['documents'] as $doc) {
    $out[] = ['document' => $doc];
  }
  return $out;
}

function field_string(array $fields, string $key): string {
  if (!isset($fields[$key])) return '';
  $v = $fields[$key];
  return is_array($v) && isset($v['stringValue']) && is_string($v['stringValue']) ? $v['stringValue'] : '';
}

function field_ts(array $fields, string $key): ?string {
  if (!isset($fields[$key])) return null;
  $v = $fields[$key];
  return is_array($v) && isset($v['timestampValue']) && is_string($v['timestampValue']) ? $v['timestampValue'] : null;
}

$cfg = get_config();
$projectId = isset($cfg['projectId']) && is_string($cfg['projectId']) ? trim($cfg['projectId']) : '';
$apiKey = isset($cfg['apiKey']) && is_string($cfg['apiKey']) ? trim($cfg['apiKey']) : '';
$siteUrl = isset($cfg['siteUrl']) && is_string($cfg['siteUrl']) ? rtrim(trim($cfg['siteUrl']), '/') : '';
if ($siteUrl === '') {
  $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'www.herosiegebuilder.com';
  $siteUrl = $scheme . '://' . $host;
}

header('Content-Type: application/rss+xml; charset=utf-8');
header('Cache-Control: public, max-age=60');

if ($projectId === '' || $apiKey === '') {
  http_response_code(200);
  echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
  echo '<rss version="2.0"><channel>';
  echo '<title>' . xml_escape('Hero Siege Builder — Website Updates') . '</title>';
  echo '<link>' . xml_escape($siteUrl . '/timeline') . '</link>';
  echo '<description>' . xml_escape('RSS not configured') . '</description>';
  echo '</channel></rss>';
  exit;
}

$results = firestore_run_query($projectId, $apiKey, 200);
if (empty($results)) {
  $results = firestore_list_documents($projectId, $apiKey, 200);
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<rss version="2.0"><channel>';
echo '<title><![CDATA[' . sanitize_text('Hero Siege Builder — Website Updates') . ']]></title>';
echo '<link><![CDATA[' . sanitize_text($siteUrl . '/timeline') . ']]></link>';
echo '<description><![CDATA[' . sanitize_text('Latest website updates and release notes') . ']]></description>';

$items = [];
foreach ($results as $row) {
  if (!is_array($row) || !isset($row['document']) || !is_array($row['document'])) continue;
  $doc = $row['document'];
  $name = isset($doc['name']) && is_string($doc['name']) ? $doc['name'] : '';
  $id = $name !== '' ? basename($name) : '';
  $fields = isset($doc['fields']) && is_array($doc['fields']) ? $doc['fields'] : [];

  $version = field_string($fields, 'version');
  $title = field_string($fields, 'title');
  $desc = field_string($fields, 'desc');
  $ts = field_ts($fields, 'createdAt');
  $pubDate = date_rss_from_ts($ts);
  if ($id === '' || $title === '') continue;

  $itemTitle = 'v' . $version . ' — ' . $title;
  $link = $siteUrl . '/timeline#' . rawurlencode($id);

  $sortKey = $ts ? strtotime($ts) : 0;
  $items[] = [
    'sort' => $sortKey,
    'xml' =>
      '<item>' .
      '<title><![CDATA[' . sanitize_text($itemTitle) . ']]></title>' .
      '<link><![CDATA[' . sanitize_text($link) . ']]></link>' .
      '<guid isPermaLink="false">' . xml_escape($id) . '</guid>' .
      '<pubDate>' . xml_escape($pubDate) . '</pubDate>' .
      '<description><![CDATA[' . sanitize_text($desc) . ']]></description>' .
      '</item>'
  ];
}
usort($items, function ($a, $b) { return $b['sort'] <=> $a['sort']; });
foreach ($items as $it) echo $it['xml'];

echo '</channel></rss>';
