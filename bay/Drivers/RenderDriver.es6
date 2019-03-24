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
		this.managers_hash = {};
		this.managers_stack = [];
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
	 * Find managers
	 */
	findManager(ui)
	{
		var class_name = (ui.kind == "component") ? ui.name : ui.class_name;
		return (this.managers_hash[class_name] != undefined) ? this.managers_hash[class_name] : null;
	}
	pushManager(ui, manager)
	{
		var class_name = (ui.kind == "component") ? ui.name : ui.class_name;
		this.managers_hash[class_name] = manager;
		this.managers_stack.push(manager);
	}
	popManager(ui)
	{
		var class_name = (ui.kind == "component") ? ui.name : ui.class_name;
		this.managers_hash[class_name] = null;
		this.managers_stack.pop();
	}
	lastManager()
	{
		if (this.managers_stack.length == 0) return this;
		return this.managers_stack[this.managers_stack.length - 1];
	}
	
	
	/**
	 * Returns new manager
	 */
	createManager(ui, model, key_manager)
	{
		var parent_manager = this.lastManager();
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
			
			this.managers[key_manager] = new_manager;
		}
		
		return new_manager;
	}
	
	
	
	/**
	 * Returns true if element and ui is different, and element must be recreated
	 */
	isElemDifferent(elem, ui)
	{
		if (elem._ui == null) return false;
		if (elem._ui == ui) return false;
		
		/* Check if different struct kind or name */
		if (elem._ui.kind != ui.kind || elem._ui.name != ui.name)
		{
			return true;
		}
		
		/* Check if different manager */
		var manager = this.findManager(ui);
		if (elem._manager != manager)
		{
			return true;
		}
		
		return false;
	}
	
	
	
	/**
	 * Update element props
	 */
	updateElemProps(elem, ui, key_path)
	{
		var ref_name = null;
		var controller = null;
		var manager = this.findManager(ui);
		
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
							var f = Runtime.rtl.find_class(class_name);
							if (f)
							{
								var event_name = f.ES6_EVENT_NAME;
								
								if (
									event_name != "" && 
									event_name != undefined && 
									elem._events[event_name] == undefined
								)
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
					
					/* Send mount event */
					controller.signal_out.dispatch( 
						new RuntimeUI.Events.MountEvent(new Runtime.Dict({
							"elem": elem,
							"ui": ui,
						})) 
					);
					
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
	updateElemAttrs(elem, ui)
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
	createDOM(prev_elem, ui, key_path)
	{
		if (prev_elem == undefined) prev_elem = null;
		
		
		/* If is component */
		if (ui.kind == Runtime.UIStruct.TYPE_ELEMENT)
		{
			var elem = document.createElement(ui.name);
			this.updateElemProps(elem, ui, key_path);
			
			/* Update element props */
			this.updateElemAttrs(elem, ui);
			
			/* Update DOM children */
			if (prev_elem != null)
			{
				while (prev_elem.hasChildNodes()) 
				{
					elem.appendChild(prev_elem.firstChild);
				}
			}
			this.updateDOMChilds(elem, ui.children, key_path);
			
			return elem;
		}
		
		/* If is string */
		else if (ui.kind == Runtime.UIStruct.TYPE_RAW)
		{
			var elem = document.createTextNode(ui.content);
			this.updateElemProps(elem, ui, key_path);
			return elem;
		}
		
		return null;
	}
	
	
	
	/**
	 * Create Document Object Model
	 */
	updateDOM(elem, ui, key_path)
	{
		if (elem._ui == ui) return elem;
		
		/* Create new DOM if elem and ui is different */
		if (this.isElemDifferent(elem, ui))
		{
			return this.createDOM(elem, ui, key_path);
		}
		
		this.updateElemProps(elem, ui, key_path);
		if (ui.kind == Runtime.UIStruct.TYPE_ELEMENT)
		{
			/* Set props */
			this.updateElemAttrs(elem, ui);
			
			/* Update DOM children */
			this.updateDOMChilds(elem, ui.children, key_path);
		}
		else if (ui.kind == Runtime.UIStruct.TYPE_RAW)
		{
			if (elem.nodeValue != ui.content)
				elem.nodeValue = ui.content;
		}
		
		return elem;
	}
	
	
	
	/**
	 * Create Document Object Model
	 */
	updateDOMChilds(elem, template, key_path)
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
				var new_manager = this.createManager(ui, model, key_manager);
				this.pushManager(ui, new_manager);
				
				
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
						var item = this.createDOM(null, t_ui, key_ui);
						if (item != null) append_arr.push(item);
					}
					else
					{
						var new_item = this.updateDOM(item, t_ui, key_ui);
						if (new_item != item)
						{
							update_arr.push({"old_item": item, "new_item": new_item});
						}
					}
				}
				
				this.popManager(ui);
			}
			
			/* if ui is element */
			else
			{
				var item = elem.childNodes[index_item];
				var key_ui = Runtime.UIStruct.getKeyPath(ui, key_path, index_template - 1);
				index_item++;
				
				if (item == undefined)
				{
					var item = this.createDOM(null, ui, key_ui);
					if (item != null) append_arr.push(item);
				}
				else
				{
					var new_item = this.updateDOM(item, ui, key_ui);
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
			index_item++;
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
		Runtime.rtl._memorizeClear();
		this.managers_hash = {};
		this.managers_stack = [];
		this.animation_id = null;
		var root = document.querySelector( this.selector );
		var template = new Runtime.Collection( 
			new Runtime.UIStruct(
				new Runtime.Dict({
					"name": this.view,
					"kind": Runtime.UIStruct.TYPE_COMPONENT,
					"model": this.model,
					"controller": "control",
				})
			)
		);
		this.updateDOMChilds(root, template, "")
	}
	
}



window['WebDriverApp'] = new RuntimeUI.Drivers.RenderDriver();
window['WebDriverApp'].run('#root', document.getElementById('view').value, document.getElementById('model').value);
