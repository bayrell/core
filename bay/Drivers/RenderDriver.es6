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


RuntimeUI.Drivers.RenderDriver = class extends RuntimeUI.Render.CoreManager
{
	
	/**
	 * Warning
	 */
	warning()
	{
		var arr = Array.apply(null, arguments);
		arr.unshift("[Warning]");
		console.log.apply(null, arr);
	}
	
	
	/**
	 * Init Driver
	 */
	_init()
	{
		super._init();
		
		this.view = null;
		this.model = null;
		this.animation_id = null;
		this.control = new RuntimeUI.UIController();
		this.control.signal_out.addMethod(
			this.modelChanged.bind(this), 
			new Runtime.Collection("RuntimeUI.Events.ModelChange")
		);
		this.managers = {};
	}
	
	
	
	/**
	 * Returns value by name
	 */
	takeValue(variable_name, default_value)
	{
		if (default_value == undefined) default_value = null;
		if (variable_name == "control") return this.control;
		return super.takeValue(variable_name, default_value);
	}
	
	
	
	/**
	 * Model changed
	 */
	modelChanged(e)
	{
		this.model = e.model;
		this.runAnimation();
		/*console.log(e.model);*/
	}
	
	
	
	/**
	 * Returns new manager
	 */
	createManager(parent_manager, key_manager, ui, model)
	{
		var manager_name = Runtime.rtl.method( ui.name, "managerName" )();
		var new_manager = null;
		var is_new = false;
		if (this.managers[key_manager] != undefined)
		{
			new_manager = this.managers[key_manager];
		}
		if (new_manager == null) is_new = true;
		else if (new_manager.getClassName() != manager_name) is_new = true;
		
		if (is_new)
		{
			/* Clear old link */
			if (new_manager != null)
			{
				new_manager.setParentManager(null, ""); /* Clear controller */
			}
			
			/* Create new manager */
			new_manager = Runtime.rtl.newInstance(manager_name);
			new_manager.setParentManager(parent_manager, ui.controller); /* Create link through controller */
			new_manager.model = model;
		}
		
		return new_manager;
	}
	
	
	
	/**
	 * Returns true if element and ui is different, and element must be recreated
	 */
	isElemDifferent(manager, elem, ui)
	{
		if (elem._ui == null) return false;
		if (elem._ui == ui) return false;
		
		/* Check if different struct kind or name */
		if (elem._ui.kind != ui.kind || elem._ui.name != ui.name)
		{
			return true;
		}
		
		/* Check if different manager */
		if (elem._manager != manager)
		{
			return true;
		}
		
		return false;
	}
	
	
	
	/**
	 * Update element props
	 */
	updateElemProps(manager, key_path, elem, ui)
	{
		var ref_name = null;
		var controller = null;
		
		
		/* Is new element */
		if (elem._ui == null)
		{
			elem._events = {};
			
			if (ui.controller != "")
			{
				controller = manager.takeValue(ui.controller);
				if (controller == null)
				{
					this.warning("Controller '" + ui.controller + "' not found in ", elem);
				}
				else
				{
					controller.ref = elem;
					if (controller.events != null)
					{
						for (var i=0; i<controller.events.count(); i++)
						{
							var class_name = controller.events.item(i);
							var event_name = Runtime.rtl.find_class(class_name).ES6_EVENT_NAME;
							
							if (event_name != "" && event_name != undefined && elem._events[event_name] == undefined)
							{
								elem.addEventListener(
									event_name, 
									(function(controller)
									{
										return function(e)
										{
											e = RuntimeUI.Events.UserEvent.UserEvent.fromEvent(e);
											controller.signal_out.dispatch(e);
										}
									})(controller)
								);
							}
						}
					}
				}
			}
		}
		
		elem._manager = manager;
		elem._key = key_path;
		elem._ui = ui;
		
		if (elem instanceof HTMLElement)
		{
			elem.setAttribute("x-key", key_path);
		}
	}
	
	
	
	/**
	 * Update element attrs
	 */
	updateElemAttrs(manager, elem, ui)
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
	createDOM(manager, key_path, prev_elem, ui)
	{
		if (prev_elem == undefined) prev_elem = null;
		
		
		/* If is component */
		if (ui.kind == Runtime.UIStruct.TYPE_ELEMENT)
		{
			var elem = document.createElement(ui.name);
			this.updateElemProps(manager, key_path, elem, ui);
			
			/* Update element props */
			this.updateElemAttrs(manager, elem, ui);
			
			/* Update DOM children */
			if (prev_elem != null)
			{
				while (prev_elem.hasChildNodes()) 
				{
					elem.appendChild(prev_elem.firstChild);
				}
			}
			this.updateDOMChilds(manager, key_path, elem, ui.children);
			
			return elem;
		}
		
		/* If is string */
		else if (ui.kind == Runtime.UIStruct.TYPE_RAW)
		{
			var elem = document.createTextNode(ui.content);
			this.updateElemProps(manager, key_path, elem, ui);
			return elem;
		}
		
		return null;
	}
	
	
	
	/**
	 * Create Document Object Model
	 */
	updateDOM(manager, key_path, elem, ui)
	{
		if (elem._ui == ui) return elem;
		
		/* Create new DOM if elem and ui is different */
		if (this.isElemDifferent(manager, elem, ui))
		{
			return this.createDOM(manager, key_path, elem, ui);
		}
		
		this.updateElemProps(manager, key_path, elem, ui);
		if (ui.kind == Runtime.UIStruct.TYPE_ELEMENT)
		{
			/* Set props */
			this.updateElemAttrs(manager, elem, ui);
			
			/* Update DOM children */
			this.updateDOMChilds(manager, key_path, elem, ui.children);
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
	updateDOMChilds(manager, key_path, elem, template)
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
				var model = Runtime.UIStruct.getModel(ui);
				var f = Runtime.rtl.method( ui.name, "render" );
				var t = f( model );
				
				
				/* Find manager by path or create new manager if does not exists */
				var key_manager = Runtime.UIStruct.getKeyPath(ui, key_path, index_template - 1);
				var new_manager = this.createManager(manager, key_manager, ui, model);
				
				
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
					var key_ui = Runtime.UIStruct.getKeyPath(t_ui, key_manager, index_t);
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
				var key_ui = Runtime.UIStruct.getKeyPath(ui, key_path, index_template - 1);
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
		
	}

	
	
	/**
	 * Run web driver
	 */
	run(selector, view, model)
	{
		model = Runtime.RuntimeUtils.json_decode( model );
		
		this.view = view;
		this.selector = selector;
		this.model = model;
		
		var root = document.querySelector( this.selector );
		root._driver = this;
		
		this.runAnimation();
	}
	
	
	/** Animation **/
	
	runAnimation()
	{
		this.animation_id = requestAnimationFrame( this.animation.bind(this) );
	}
	
	
	
	/**
	 * Animation function
	 */
	animation()
	{
		this.animation_id = null;
		var root = document.querySelector( this.selector );
		var template = new Runtime.Collection( 
			new Runtime.UIStruct(
				new Runtime.Dict({
					"name": this.view,
					"kind": Runtime.UIStruct.TYPE_COMPONENT,
					"model": this.model,
					"controller": "control",
					"props": new Runtime.Dict({
						"@key": "root",
					}),
				})
			)
		);
		this.updateDOMChilds(this, "", root, template)
	}
	
}



window['WebDriverApp'] = new RuntimeUI.Drivers.RenderDriver();
window['WebDriverApp'].run('#root', document.getElementById('view').value, document.getElementById('model').value);
