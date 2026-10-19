<?php
/**
 * Plugin Name: MerinDocs SSO
 * Description: 授权码模式单点登录：为笔记站提供授权确认页 /merin-sso/authorize/ 与服务端换用户信息接口 /merin-sso/exchange/。
 * Author: Tinsur
 * Version: 2.0.3
 *
 * 用法：放到 wp-content/mu-plugins/merin-sso.php（mu-plugins 放入即生效）。
 * 注意：本方案不需要、也不要在 wp-config.php 设置 COOKIE_DOMAIN。
 */

/**
 * 客户端注册表：
 * - secret：与笔记站环境变量 WP_CLIENT_SECRET 保持一致，请改成你自己的随机串
 * - redirect_uris：授权后允许跳回的笔记站回调地址，必须逐字符完全匹配
 */
if ( ! defined( 'MERIN_SSO_CLIENTS' ) ) {
	define(
		'MERIN_SSO_CLIENTS',
		array(
			'merindocs' => array(
				'name'          => 'MerinDocs 笔记站',
				'secret'        => '92b2bb13f8f750ac9d794fee5f25c244f577286225b764d2',
				'redirect_uris' => array(
					'https://note.tinsur.cn/api/auth/callback',
				),
			),
		)
	);
}

/**
 * 本插件只服务前台两个自定义端点。登录页(wp-login)、后台(admin)、
 * REST、XML-RPC、WP-Cron、WP-CLI 等上下文一律不注册任何钩子，
 * 避免与 WordPress 自身登录/后台流程产生任何交集。
 */
function merin_sso_bootstrap() {
	$script = isset( $_SERVER['SCRIPT_NAME'] ) ? basename( wp_unslash( $_SERVER['SCRIPT_NAME'] ) ) : '';
	if (
		is_admin()
		|| 'wp-login.php' === $script
		|| 'wp-register.php' === $script
		|| ( defined( 'XMLRPC_REQUEST' ) && XMLRPC_REQUEST )
		|| ( defined( 'DOING_CRON' ) && DOING_CRON )
		|| ( defined( 'REST_REQUEST' ) && REST_REQUEST )
		|| ( defined( 'WP_CLI' ) && WP_CLI )
	) {
		return;
	}

	/**
	 * 注册自定义端点：
	 *   /merin-sso/authorize/  用户授权确认（浏览器）
	 *   /merin-sso/exchange/   服务端用授权码换用户信息（笔记站后端调用）
	 */
	add_action(
		'init',
		function () {
			add_rewrite_rule( '^merin-sso/(authorize|exchange)/?$', 'index.php?merin_sso_action=$matches[1]', 'top' );
		}
	);

	add_filter(
		'query_vars',
		function ( $vars ) {
			$vars[] = 'merin_sso_action';
			return $vars;
		}
	);

	// 端点变化或插件曾被停用后，自动补刷一次固定链接规则
	add_action(
		'init',
		function () {
			if ( get_option( 'merin_sso_rewrite_version' ) !== '3' ) {
				flush_rewrite_rules();
				update_option( 'merin_sso_rewrite_version', '3' );
			}
		},
		20
	);

	add_action( 'template_redirect', 'merin_sso_dispatch' );
}
add_action( 'muplugins_loaded', 'merin_sso_bootstrap' );

function merin_sso_dispatch() {
	$action = get_query_var( 'merin_sso_action' );
	if ( 'authorize' === $action ) {
		merin_sso_authorize();
	}
	if ( 'exchange' === $action ) {
		merin_sso_exchange();
	}
}

/** 取已注册的客户端配置 */
function merin_sso_get_client( $client_id ) {
	$clients = MERIN_SSO_CLIENTS;
	return ( is_string( $client_id ) && isset( $clients[ $client_id ] ) ) ? $clients[ $client_id ] : null;
}

/** 中文错误提示页 */
function merin_sso_die( $message, $status = 400 ) {
	status_header( $status );
	wp_die(
		'<h1>授权请求无效</h1><p>' . esc_html( $message ) . '</p><p><a href="' . esc_url( home_url( '/' ) ) . '">返回站点首页</a></p>',
		'授权请求无效',
		array( 'response' => $status )
	);
}

/** 授权确认页（GET 展示 / POST 处理用户决定） */
function merin_sso_authorize() {
	$client_id    = isset( $_GET['client_id'] ) ? sanitize_text_field( wp_unslash( $_GET['client_id'] ) ) : '';
	$redirect_uri = isset( $_GET['redirect_uri'] ) ? esc_url_raw( wp_unslash( $_GET['redirect_uri'] ) ) : '';
	$state        = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( $_GET['state'] ) ) : '';
	$client       = merin_sso_get_client( $client_id );

	if ( ! $client || ! in_array( $redirect_uri, $client['redirect_uris'], true ) ) {
		// 客户端或回调地址不合法：不跳转，直接报错（防开放重定向）
		merin_sso_die( '客户端或回调地址未登记，请联系站点管理员。' );
	}

	// 未登录：先去 WP 登录页，登录后回到本授权页（同域 redirect_to，参数原样保留）
	if ( ! is_user_logged_in() ) {
		$current = home_url( '/merin-sso/authorize/' ) . ( isset( $_SERVER['QUERY_STRING'] ) ? '?' . wp_unslash( $_SERVER['QUERY_STRING'] ) : '' );
		wp_safe_redirect( wp_login_url( $current ) );
		exit;
	}

	$user = wp_get_current_user();

	// 用户提交决定
	if ( isset( $_SERVER['REQUEST_METHOD'] ) && 'POST' === $_SERVER['REQUEST_METHOD'] ) {
		check_admin_referer( 'merin_sso_authorize' );

		// redirect_uri 已在上面与注册表精确匹配过（跨主机的笔记站域名），
		// 不能用 wp_safe_redirect：它只允许跳 WP 自身主机，跨子域会被拦下来并兜底跳 wp-admin
		if ( isset( $_POST['cancel'] ) ) {
			wp_redirect( add_query_arg( array( 'error' => 'access_denied', 'state' => $state ), $redirect_uri ) );
			exit;
		}

		// 同意授权：生成一次性授权码，60 秒过期
		$code = bin2hex( random_bytes(32) );
		set_transient(
			'merin_sso_code_' . $code,
			array(
				'user_id'   => (int) $user->ID,
				'client_id' => $client_id,
			),
			60
		);
		wp_redirect( add_query_arg( array( 'code' => $code, 'state' => $state ), $redirect_uri ) );
		exit;
	}

	// 展示授权确认页（自包含简单页面，不依赖主题）
	$blog_name   = get_bloginfo( 'name' );
	$client_name = $client['name'];
	$initial     = function_exists( 'mb_substr' ) ? mb_substr( $user->display_name, 0, 1 ) : substr( $user->display_name, 0, 1 );

	header( 'Content-Type: text/html; charset=utf-8' );
	?>
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>授权登录 - <?php echo esc_html( $blog_name ); ?></title>
<style>
	* { box-sizing: border-box; }
	body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
		background: #f0f2f5; font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; color: #1d2129; padding: 20px; }
	.card { width: 100%; max-width: 380px; background: #fff; border-radius: 14px; padding: 34px 30px 28px;
		box-shadow: 0 10px 36px rgba(0,0,0,.10); text-align: center; }
	.avatar { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 14px;
		background: #1f6feb; color: #fff; font-size: 28px; display: flex; align-items: center; justify-content: center; }
	h1 { font-size: 19px; margin: 0 0 10px; }
	p { font-size: 14px; line-height: 1.7; color: #4e5969; margin: 0 0 22px; }
	.app-name { color: #1f6feb; font-weight: 600; }
	.actions { display: flex; gap: 12px; }
	button { flex: 1; height: 40px; border-radius: 8px; font-size: 14px; cursor: pointer; border: 1px solid transparent; }
	.btn-ok { background: #1f6feb; color: #fff; }
	.btn-ok:hover { background: #1a5fd0; }
	.btn-cancel { background: #fff; border-color: #d9dce3; color: #4e5969; }
	.btn-cancel:hover { border-color: #86909c; }
	.foot { margin-top: 20px; font-size: 12px; color: #86909c; }
</style>
</head>
<body>
	<form class="card" method="post">
		<div class="avatar"><?php echo esc_html( strtoupper( $initial ) ); ?></div>
		<h1><?php echo esc_html( $user->display_name ); ?>，你好</h1>
		<p><span class="app-name"><?php echo esc_html( $client_name ); ?></span> 请求获得你的账户基本信息（用户名、昵称、角色），用于完成登录。</p>
		<div class="actions">
			<button type="submit" name="cancel" value="1" class="btn-cancel">拒绝</button>
			<button type="submit" name="allow" value="1" class="btn-ok">同意授权</button>
		</div>
		<?php wp_nonce_field( 'merin_sso_authorize' ); ?>
		<div class="foot">由 <?php echo esc_html( $blog_name ); ?> 账户提供授权</div>
	</form>
</body>
</html>
	<?php
	exit;
}

/** 服务端换用户信息：校验客户端密钥 + 一次性授权码 */
function merin_sso_exchange() {
	$client_id     = isset( $_POST['client_id'] ) ? sanitize_text_field( wp_unslash( $_POST['client_id'] ) ) : '';
	$client_secret = isset( $_POST['client_secret'] ) ? wp_unslash( $_POST['client_secret'] ) : '';
	$code          = isset( $_POST['code'] ) ? sanitize_text_field( wp_unslash( $_POST['code'] ) ) : '';

	header( 'Content-Type: application/json; charset=utf-8' );

	$client = merin_sso_get_client( $client_id );
	if ( ! $client || ! is_string( $client_secret ) || ! hash_equals( (string) $client['secret'], $client_secret ) ) {
		status_header( 401 );
		echo wp_json_encode( array( 'error' => 'invalid_client' ) );
		exit;
	}

	if ( ! preg_match( '/^[0-9a-f]{64}$/', $code ) ) {
		status_header( 400 );
		echo wp_json_encode( array( 'error' => 'invalid_code' ) );
		exit;
	}

	$transient_key = 'merin_sso_code_' . $code;
	$data          = get_transient( $transient_key );
	if ( ! $data || ! isset( $data['user_id'] ) || $data['client_id'] !== $client_id ) {
		status_header( 400 );
		echo wp_json_encode( array( 'error' => 'invalid_code' ) );
		exit;
	}
	delete_transient( $transient_key ); // 授权码一次性，用过即废

	$wp_user = get_userdata( (int) $data['user_id'] );
	if ( ! $wp_user ) {
		status_header( 401 );
		echo wp_json_encode( array( 'error' => 'invalid_user' ) );
		exit;
	}

	echo wp_json_encode(
		array(
			'id'           => $wp_user->ID,
			'name'         => $wp_user->user_login,
			'display_name' => $wp_user->display_name,
			'roles'        => $wp_user->roles,
			'avatar'       => get_avatar_url(
				$wp_user->ID,
				array( 'size' => 128 )
			),
		)
	);
	exit;
}
