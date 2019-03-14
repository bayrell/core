"use strict;"
/*!
 *  Bayrell Runtime Library
 *
 *  (c) Copyright 2016-2018 "Ildar Bikmamatov" <support@bayrell.org>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      https://www.bayrell.org/licenses/APACHE-LICENSE-2.0.html
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

if (typeof RuntimeUI == 'undefined') RuntimeUI = {};
if (typeof RuntimeUI.Drivers == 'undefined') RuntimeUI.Drivers = {};


RuntimeUI.Drivers.RenderDriver = function()
{
	this.view = null;
	this.model = null;
	this.template = null;
	this.animation_id = null;
	return this;
}



/**
 * Create DOM by UI Struct
 */
RuntimeUI.Drivers.RenderDriver.setElemProps = function(elem, ui)
{
	/* Build attrs */
	var attrs = RuntimeUI.Render.RenderHelper.getUIAttrs(ui);
	if (attrs == null)
	{
		return;
	}
	
	var is_input = ["INPUT", "SELECT"].indexOf(elem.tagName) >= 0;
	attrs.each(
		(key, value) => 
		{
			if (is_input && key == "value") return;
			elem.setAttribute(key, value);
		}
	);
	
	if (is_input)
	{
		elem.value = attrs.get("value", "");
	}
	
}



/**
 * Create DOM by UI Struct
 */
RuntimeUI.Drivers.RenderDriver.createDOM = function(prev_elem, ui)
{
	if (prev_elem == undefined) prev_elem = null;
	
	if (ui.kind == Runtime.UIStruct.TYPE_ELEMENT)
	{
		var elem = document.createElement(ui.name);
		elem.ui_struct = ui;
		
		/* Set props */
		this.setElemProps(elem, ui);
		
		/* Update DOM children */
		if (prev_elem != null)
		{
			while (prev_elem.childNodes.hasChildNodes()) 
			{
				elem.appendChild(prev_elem.firstChild);
			}
		}
		this.updateDOMChilds(elem, ui.children);
		
		return elem;
	}
	else if (ui.kind == Runtime.UIStruct.TYPE_RAW)
	{
		var elem = document.createTextNode(ui.content);
		elem.ui_struct = ui;
		return elem;
	}
	
	return null;
}



/**
 * Create Document Object Model
 */
RuntimeUI.Drivers.RenderDriver.updateDOM = function(elem, ui)
{
	if (elem.ui_struct == ui) return elem;
	
	/* Create new DOM if different */
	if (elem.ui_struct != null)
	{
		if (elem.ui_struct.kind != ui.kind || elem.ui_struct.name != ui.name)
		{
			return this.createDOM(elem, ui);
		}
	}
	
	elem.ui_struct = ui;
	if (ui.kind == Runtime.UIStruct.TYPE_ELEMENT)
	{
		/* Set props */
		this.setElemProps(elem, ui);
		
		/* Update DOM children */
		this.updateDOMChilds(elem, ui.children);
	}
	else if (ui.kind == Runtime.UIStruct.TYPE_RAW)
	{
		elem.nodeValue = ui.content;
	}
	
	return elem;
}



/**
 * Create Document Object Model
 */
RuntimeUI.Drivers.RenderDriver.updateDOMChilds = function(elem, template)
{
	
	if (template == null)
	{
		return;
	}
	
	var append_arr = [];
	var update_arr = [];
	var remove_arr = [];
	var index = 0;
	
	while (index < elem.childNodes.length)
	{
		var item = elem.childNodes[index];
		var ui = template.get(index, null);
		if (ui != null)
		{
			var new_item = this.updateDOM(item, ui);
			if (new_item != item)
			{
				update_arr.push({"old_item": item, "new_item": new_item});
			}
		}
		else
		{
			remove_arr.push(item);
		}
		index++;
	}
	
	while (index < template.count())
	{
		var ui = template.get(index, null);
		var item = this.createDOM(null, ui);
		if (item != null) append_arr.push(item);
		index++;
	}
	
	
	/* Apply changes */
	for (var i=0; i<remove_arr.length; i++)
	{
		elem.removeChild( remove_arr[i] );
	}
	for (var i=0; i<append_arr.length; i++)
	{
		elem.appendChild( append_arr[i] );
	}
	for (var i=0; i<update_arr.length; i++)
	{
		elem.replaceChild(update_arr[i].new_item, update_arr[i].old_item);
	}
	
}



Object.assign( RuntimeUI.Drivers.RenderDriver.prototype, {
	
	
	/**
	 * Run web driver
	 */
	run: function(selector, view, model)
	{
		model = Runtime.RuntimeUtils.json_decode( model );
		
		this.view = view;
		this.selector = selector;
		this.model = model;
		
		var f = Runtime.rtl.method(this.view, "render");
		this.template = f(model);
		/*console.log(this.template);*/
		
		this.runAnimation();
	},
	
	
	/** Animation **/
	
	animation_id: null,
	runAnimation: function()
	{
		this.animation_id = requestAnimationFrame( this.animation.bind(this) );
	},
	
	
	
	/**
	 * Animation function
	 */
	animation()
	{
		this.animation_id = null;
		var root = document.querySelector( this.selector );
		RuntimeUI.Drivers.RenderDriver.updateDOMChilds(root, this.template)
	},
	
});



window['WebDriverApp'] = new RuntimeUI.Drivers.RenderDriver();
window['WebDriverApp'].run('#root', document.getElementById('view').value, document.getElementById('model').value);
