"use strict;"
/*!
 *  Bayrell Core Library
 *
 *  (c) Copyright 2018-2019 "Ildar Bikmamatov" <support@bayrell.org>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

Core.UI.Drivers.ApiWPDriver = class
{
	
	/**
	 * Convert data to Native for ajax POST request
	 * @params serializable data
	 * @return Vector
	 */
	static buildPostData(data)
	{
		var res = [];
		var json = Runtime.RuntimeUtils.json_encode(data);
		json = Runtime.RuntimeUtils.base64_encode(json);
		res.push({"key": "DATA", "val": json});
		return res;
	}
	
	
	
	/**
	 * Returns POST data
	 * @params Object res
	 * @params var data
	 */
	static buildPostDataRecursive(res, data, key)
	{
		if (
			Runtime.rtl.isScalarValue(data) ||
			data instanceof FileList ||
			data instanceof File
		)
		{
			if (data != null)
			{
				res.data.push({"key": key, "val": data});
			}
			else
			{
				res.data.push({"key": key, "val": ""});
			}
		}
		else if (data instanceof Runtime.Dict)
		{
			data.each(
				(i, item) => {
					Core.UI.Drivers.ApiWPDriver.buildPostDataRecursive(
						res, 
						item, 
						(key == "") ? i : key + "[" + i + "]"
					);
				}
			);
		}
		else if (Array.isArray(data))
		{
			for (var i=0; i<data.length; i++)
			{
				Core.UI.Drivers.ApiWPDriver.buildPostDataRecursive(
					res, 
					data[i], 
					(key == "") ? i : key + "[" + i + "]"
				);
			}
		}
		else if (typeof data == 'object')
		{
			for (var i in data)
			{
				Core.UI.Drivers.ApiWPDriver.buildPostDataRecursive(
					res, 
					data[i], 
					(key == "") ? i : key + "[" + i + "]"
				);
			}
		}
	}
	
	
	
	/**
	 * Send api request
	 * @param string class_name
	 * @param string method_name
	 * @param Map<string, mixed> data
	 * @param callback f
	 */ 
	sendApi(class_name, method_name, data, f)
	{
		
		var post_data = new FormData();
		
		/* Build pos data */
		data = Core.UI.Drivers.ApiWPDriver.buildPostData(data);
		
		/* Add data to post data */
		for (var i=0; i<data.length; i++)
		{
			var obj = data[i];
			var key = obj.key;
			var val = obj.val;
			if (val instanceof FileList)
			{
				for (var i=0; i<val.length; i++)
				{
					post_data.append(key + "[]", val.item(i), val.item(i).name);
				}
			}
			else if (val instanceof File)
			{
				post_data.append(key, val, val.name);
			}
			else
			{
				post_data.append(key, val);
			}
		}
		
		/* Add CSRF Token */
		/*post_data.append("csrf_token", Core.UI.Drivers.ApiWPDriver.GetCookie("csrf_token"));*/
		
		/* Send AJAX Request */
		var xhr = new XMLHttpRequest();
		xhr.open('POST', '/wp-json/elberos/' + class_name + '/' + method_name + '/', true);
		xhr.send(post_data);
		xhr.onreadystatechange = (function(xhr, f, class_name, method_name) {
			return function()
			{
				var r = new Runtime.Map({
					"success": false,
					"class_name": class_name,
					"method_name": method_name,
					"error": 0,
					"code": 0,
					"text": xhr.responseText,
					"result": null,
				});
				if (xhr.readyState != 4) return;
				if (xhr.status == 200)
				{
					var data = {};
					var exists = Runtime.rtl.exists;
					try
					{
						data = JSON.parse(xhr.responseText);
						if (f != undefined && f != null)
						{
							var success = exists(data.success) ? data.success : false;
							var error = exists(data.error) ? data.error : "Unknown error";
							var code = exists(data.code) ? data.code : Runtime.RuntimeConstant.ERROR_UNKNOWN;
							var res = exists(data.result) ? data.result : null;
							res = Runtime.RuntimeUtils.NativeToObject(res);
							r.set("success", true)
								.set("error", error)
								.set("code", code)
								.set("result", res)
							;
							f(r);
						}
					}
					catch (e)
					{
						if (f != undefined && f != null)
						{
							r.set("success", false)
								.set("error", "Json parse error")
								.set("code", Runtime.RuntimeConstant.ERROR_PARSE_SERIALIZATION_ERROR)
							;
							f(r);
						}
					}
				}
				else
				{
					if (f != undefined && f != null)
					{
						r.set("success", false)
							.set("error", "Error code " + xhr.status)
							.set("code", Runtime.RuntimeConstant.ERROR_RESPONSE)
						;
						f(r);
					}
				}
			}
		})(xhr, f, class_name, method_name);
	}
	
	
}


var context = Runtime.RuntimeUtils.getContext();
context.registerDriver("core.ui.bus", new Core.UI.Drivers.ApiWPDriver());