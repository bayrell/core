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
	this.managers = {};
	return this;
}


Object.assign( RuntimeUI.Drivers.RenderDriver.prototype, {
	
	
	
	/**
	 * Create DOM by UI Struct
	 */
	setElemKeys: function(manager, key_path, elem, ui)
	{
		elem._key = key_path;
		elem._manager = manager;
		elem._ui_struct = ui;
		
		if (elem instanceof HTMLElement)
		{
			elem.setAttribute("x-key", key_path);
		}
	},
	
	
	
	/**
	 * Create DOM by UI Struct
	 */
	setElemProps: function(elem, ui)
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
		
		if (ui.props != null)
		{
			ui.props.each(
				(key, value) => 
				{
					if (key == "@ref")
					{
						elem._manager.appendControl(elem, value);
					}
				}
			);
		}
		
	},
	
	
	
	/**
	 * Create DOM by UI Struct
	 */
	createDOM: function(manager, key_path, prev_elem, ui)
	{
		if (prev_elem == undefined) prev_elem = null;
		
		if (ui.kind == Runtime.UIStruct.TYPE_ELEMENT)
		{
			var elem = document.createElement(ui.name);
			this.setElemKeys(manager, key_path, elem, ui);
			
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
			this.updateDOMChilds(manager, key_path, elem, ui.children);
			
			return elem;
		}
		else if (ui.kind == Runtime.UIStruct.TYPE_RAW)
		{
			var elem = document.createTextNode(ui.content);
			this.setElemKeys(manager, key_path, elem, ui);
			return elem;
		}
		
		return null;
	},
	
	
	
	/**
	 * Create Document Object Model
	 */
	updateDOM: function(manager, key_path, elem, ui)
	{
		if (elem._ui_struct == ui) return elem;
		
		/* Create new DOM if different */
		if (elem._ui_struct != null)
		{
			if (elem._ui_struct.kind != ui.kind || elem._ui_struct.name != ui.name)
			{
				return this.createDOM(manager, key_path, elem, ui);
			}
		}
		
		this.setElemKeys(manager, key_path, elem, ui);
		if (ui.kind == Runtime.UIStruct.TYPE_ELEMENT)
		{
			/* Set props */
			this.setElemProps(elem, ui);
			
			/* Update DOM children */
			this.updateDOMChilds(manager, key_path, elem, ui.children);
		}
		else if (ui.kind == Runtime.UIStruct.TYPE_RAW)
		{
			elem.nodeValue = ui.content;
		}
		
		return elem;
	},
	
	
	
	/**
	 * Create Document Object Model
	 */
	updateDOMChilds: function(manager, key_path, elem, template)
	{
		
		if (template == null)
		{
			return;
		}
		
		
		var append_arr = [];
		var update_arr = [];
		var remove_arr = [];
		var index_item = 0;
		var index_template = 0;
		
		
		while (index_template < template.count())
		{
			var ui = template.item(index_template);
			index_template ++;
			
			/* if ui is component */
			if (ui.kind == Runtime.UIStruct.TYPE_COMPONENT)
			{
				
				/* Render view */
				var model = ui.getModel();
				var f = Runtime.rtl.method( ui.name, "render" );
				var t = f( model );
				
				
				/* Find manager by path or create new manager if does not exists */
				var key_manager = ui.getKeyPath(key_path, index_template - 1);
				var new_manager = null;
				if (this.managers[key_manager] == undefined)
				{
					var manager_name = Runtime.rtl.method( ui.name, "managerName" )();
					var new_manager = Runtime.rtl.newInstance(manager_name);
				}
				else
				{
					new_manager = this.managers[key_manager];
				}
				new_manager.model = model;
				
				
				/* Normalize ui vector */
				if (!(t instanceof Runtime.Collection))
				{
					t = Runtime.RuntimeUtils.normalizeUIVector(t);
				}
				
				
				/* Analyze view struct */
				for (var index_t=0; index_t<t.count(); index_t++)
				{
					var t_ui = t.item(index_t);
					var item = elem.childNodes[index_item];
					var key_ui = t_ui.getKeyPath(key_manager, index_t);
					index_item++;
					
					if (item == undefined)
					{
						var item = this.createDOM(new_manager, key_ui, null, t_ui);
						if (item != null) append_arr.push(item);
					}
					else
					{
						var new_item = this.updateDOM(new_manager, key_ui, item, t_ui);
						if (new_item != item)
						{
							update_arr.push({"old_item": item, "new_item": new_item});
						}
					}
				}
				
			}
			
			/* if ui is element */
			else
			{
				var item = elem.childNodes[index_item];
				var key_ui = ui.getKeyPath(key_path, index_template - 1);
				index_item++;
				
				if (item == undefined)
				{
					var item = this.createDOM(manager, key_ui, null, ui);
					if (item != null) append_arr.push(item);
				}
				else
				{
					var new_item = this.updateDOM(manager, key_ui, item, ui);
					if (new_item != item)
					{
						update_arr.push({"old_item": item, "new_item": new_item});
					}
				}
			}
			
		}
		
		
		/* Remove items */
		while (index_item < elem.childNodes.length)
		{
			var item = elem.childNodes[index_item];
			remove_arr.push(item);
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
		
	},

	
	
	/**
	 * Run web driver
	 */
	run: function(selector, view, model)
	{
		model = Runtime.RuntimeUtils.json_decode( model );
		
		this.view = view;
		this.selector = selector;
		this.model = model;
		
		this.template = new Runtime.Collection( 
			new Runtime.UIStruct(
				new Runtime.Dict({
					"name": this.view,
					"kind": Runtime.UIStruct.TYPE_COMPONENT,
					"model": this.model,
				})
			)
		);
		
		var root = document.querySelector( this.selector );
		root._driver = this;
		
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
		this.updateDOMChilds(null, "", root, this.template)
	},
	
});



window['WebDriverApp'] = new RuntimeUI.Drivers.RenderDriver();
window['WebDriverApp'].run('#root', document.getElementById('view').value, document.getElementById('model').value);
